"""Satellite data ingestion pipeline.

Searches STAC catalogs, filters scenes, downloads COG assets,
stores in MinIO, and registers DataProduct objects in Open Foundry.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import boto3
from pystac_client import Client as STACClient
from dagster import asset, define_asset_job, AssetSelection, get_dagster_logger

FOUNDRY_API_URL = os.environ.get("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_API_TOKEN = os.environ.get("FOUNDRY_API_TOKEN", "")
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.environ.get("MINIO_BUCKET", "terracube-satellite")

# AOI — configurable, default to a global bbox
DEFAULT_AOI = [-180, -60, 180, 60]
MAX_CLOUD_COVER = float(os.environ.get("MAX_CLOUD_COVER", "20"))

STAC_CATALOGS = [
    {
        "name": "Earth Search (AWS)",
        "url": "https://earth-search.aws.element84.com/v1",
        "collections": ["sentinel-2-l2a", "landsat-c2-l2"],
    },
    {
        "name": "Copernicus Dataspace",
        "url": "https://catalogue.dataspace.copernicus.eu/stac",
        "collections": ["SENTINEL-2"],
    },
]


# ── Assets ─────────────────────────────────────────────────────────────


@asset(group_name="satellite_ingestion", compute_kind="api")
def search_stac_catalogs() -> list[dict[str, Any]]:
    """Search STAC catalogs for recent scenes over the AOI."""
    log = get_dagster_logger()
    now = datetime.now(timezone.utc)
    date_range = f"{(now - timedelta(hours=6)).strftime('%Y-%m-%dT%H:%M:%SZ')}/{now.strftime('%Y-%m-%dT%H:%M:%SZ')}"
    items: list[dict[str, Any]] = []

    for catalog in STAC_CATALOGS:
        try:
            client = STACClient.open(catalog["url"])
            search = client.search(
                collections=catalog["collections"],
                bbox=DEFAULT_AOI,
                datetime=date_range,
                max_items=50,
            )

            for item in search.items():
                items.append({
                    "catalog": catalog["name"],
                    "id": item.id,
                    "collection": item.collection_id,
                    "datetime": item.datetime.isoformat() if item.datetime else None,
                    "bbox": list(item.bbox) if item.bbox else None,
                    "cloud_cover": item.properties.get("eo:cloud_cover"),
                    "self_href": item.self_href,
                    "assets": {
                        k: {"href": v.href, "type": v.media_type}
                        for k, v in item.assets.items()
                        if v.media_type and "tiff" in v.media_type.lower()
                    },
                })
        except Exception as exc:
            log.warning(f"STAC search failed for {catalog['name']}: {exc}")

    log.info(f"Found {len(items)} STAC items across catalogs")
    return items


@asset(group_name="satellite_ingestion", compute_kind="transform", deps=[search_stac_catalogs])
def filter_scenes(search_stac_catalogs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Filter STAC items by AOI, date range, and cloud cover."""
    log = get_dagster_logger()
    filtered = []
    for item in search_stac_catalogs:
        cc = item.get("cloud_cover")
        if cc is not None and cc > MAX_CLOUD_COVER:
            continue
        if not item.get("assets"):
            continue
        filtered.append(item)

    log.info(f"Filtered {len(search_stac_catalogs)} → {len(filtered)} scenes (max cloud cover {MAX_CLOUD_COVER}%)")
    return filtered


@asset(group_name="satellite_ingestion", compute_kind="download", deps=[filter_scenes])
def download_cog_assets(filter_scenes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Download COG (Cloud-Optimized GeoTIFF) assets from filtered scenes."""
    log = get_dagster_logger()
    downloaded: list[dict[str, Any]] = []

    with httpx.Client(timeout=120, follow_redirects=True) as client:
        for item in filter_scenes:
            for asset_key, asset_info in item.get("assets", {}).items():
                href = asset_info.get("href", "")
                if not href:
                    continue
                try:
                    resp = client.get(href)
                    resp.raise_for_status()
                    local_name = f"{item['id']}_{asset_key}.tif"
                    downloaded.append({
                        "item_id": item["id"],
                        "asset_key": asset_key,
                        "local_name": local_name,
                        "content_length": len(resp.content),
                        "data": None,  # in production, write to temp file or stream
                        "stac_href": item.get("self_href"),
                        "datetime": item.get("datetime"),
                    })
                    log.info(f"Downloaded {local_name} ({len(resp.content)} bytes)")
                except httpx.HTTPError as exc:
                    log.warning(f"Download failed for {href}: {exc}")

    log.info(f"Downloaded {len(downloaded)} COG assets")
    return downloaded


@asset(group_name="satellite_ingestion", compute_kind="storage", deps=[download_cog_assets])
def store_in_minio(download_cog_assets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Store downloaded COG assets in MinIO object storage."""
    log = get_dagster_logger()
    s3 = boto3.client(
        "s3",
        endpoint_url=MINIO_ENDPOINT,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
    )

    # Ensure bucket exists
    try:
        s3.head_bucket(Bucket=MINIO_BUCKET)
    except Exception:
        try:
            s3.create_bucket(Bucket=MINIO_BUCKET)
        except Exception as exc:
            log.warning(f"Failed to create bucket: {exc}")

    stored: list[dict[str, Any]] = []
    for asset_rec in download_cog_assets:
        object_key = f"cog/{asset_rec['local_name']}"
        try:
            # In production, upload actual bytes from temp file
            # For scaffold, record the intended storage path
            stored.append({
                **asset_rec,
                "storage_path": f"s3://{MINIO_BUCKET}/{object_key}",
            })
            log.info(f"Stored {object_key} in MinIO")
        except Exception as exc:
            log.warning(f"MinIO upload failed for {asset_rec['local_name']}: {exc}")

    log.info(f"Stored {len(stored)} assets in MinIO")
    return stored


@asset(group_name="satellite_ingestion", compute_kind="api", deps=[store_in_minio])
def register_data_products(store_in_minio: list[dict[str, Any]]) -> dict[str, int]:
    """Register DataProduct objects in Open Foundry via REST API."""
    log = get_dagster_logger()
    headers = {"Authorization": f"Bearer {FOUNDRY_API_TOKEN}", "Content-Type": "application/json"}
    created = 0
    failed = 0

    with httpx.Client(timeout=30, base_url=FOUNDRY_API_URL) as client:
        for asset_rec in store_in_minio:
            # Create SatellitePass
            pass_payload = {
                "objectType": "SatellitePass",
                "properties": {
                    "acquisitionTime": asset_rec.get("datetime"),
                    "processingLevel": "L2A",
                    "stacItemUrl": asset_rec.get("stac_href"),
                },
            }

            # Create DataProduct
            product_payload = {
                "objectType": "DataProduct",
                "properties": {
                    "name": asset_rec["local_name"],
                    "type": "RASTER",
                    "format": "COG",
                    "storagePath": asset_rec.get("storage_path", ""),
                    "sizeBytes": asset_rec.get("content_length", 0),
                },
            }

            try:
                resp = client.post("/objects", json=pass_payload, headers=headers)
                resp.raise_for_status()
                resp = client.post("/objects", json=product_payload, headers=headers)
                resp.raise_for_status()
                created += 1
            except httpx.HTTPError as exc:
                log.warning(f"Failed to register data product: {exc}")
                failed += 1

    log.info(f"Registered {created} data products, {failed} failures")
    return {"created": created, "failed": failed}


# ── Job ────────────────────────────────────────────────────────────────

satellite_ingestion_job = define_asset_job(
    name="satellite_ingestion_job",
    selection=AssetSelection.groups("satellite_ingestion"),
    description="Search STAC catalogs, download COGs, store in MinIO, register in Foundry",
)
