"""Satellite data ingestion pipeline.

Searches STAC catalogs, filters scenes, enriches metadata with an LLM,
resolves open COG assets, and registers ontology objects in Open Foundry.
"""

from __future__ import annotations

import os
import hashlib
import json
import tempfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

import boto3
import httpx
from botocore import UNSIGNED
from botocore.config import Config
from dagster import asset, define_asset_job, AssetSelection, get_dagster_logger
from pystac_client import Client as STACClient

from ai_ingest.llm_client import LLMClient

FOUNDRY_API_URL = os.environ.get("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_API_TOKEN = os.environ.get("FOUNDRY_API_TOKEN", "")
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.environ.get("MINIO_BUCKET", "terracube-satellite")

# AOI — configurable, default to a global bbox
DEFAULT_AOI = [-180, -60, 180, 60]
MAX_CLOUD_COVER = float(os.environ.get("MAX_CLOUD_COVER", "20"))
STAC_LOOKBACK_HOURS = int(os.environ.get("STAC_LOOKBACK_HOURS", "6"))
STAC_MAX_ITEMS = int(os.environ.get("STAC_MAX_ITEMS", "50"))
SATELLITE_LLM_MAX_ITEMS = int(os.environ.get("SATELLITE_LLM_MAX_ITEMS", "10"))
SATELLITE_MAX_ASSETS_PER_SCENE = int(os.environ.get("SATELLITE_MAX_ASSETS_PER_SCENE", "5"))
SATELLITE_ASSET_STORAGE_MODE = os.environ.get("SATELLITE_ASSET_STORAGE_MODE", "reference").lower()
SATELLITE_ASSET_KEYS = tuple(
    key.strip()
    for key in os.environ.get(
        "SATELLITE_ASSET_KEYS",
        "visual,red,green,blue,nir,nir08,swir16,swir22,scl,B04_10m,B08_10m,TCI_10m",
    ).split(",")
    if key.strip()
)

_llm = LLMClient()

STAC_CATALOGS = [
    {
        "name": "Earth Search (AWS)",
        "url": "https://earth-search.aws.element84.com/v1",
        "collections": ["sentinel-2-l2a", "landsat-c2-l2"],
    },
    {
        "name": "Copernicus Dataspace",
        "url": "https://stac.dataspace.copernicus.eu/v1",
        "collections": ["sentinel-2-l2a"],
    },
]


# ── Helpers ───────────────────────────────────────────────────────────


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _stable_id(*parts: Any) -> str:
    raw = "|".join(str(p) for p in parts if p is not None)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:20]


def _processing_level(item: dict[str, Any]) -> str:
    text = f"{item.get('collection', '')} {item.get('id', '')}".lower()
    if "l3" in text:
        return "L3"
    if "l2b" in text:
        return "L2B"
    if "l2a" in text or "msil2a" in text:
        return "L2A"
    if "l1b" in text:
        return "L1B"
    if "l1a" in text:
        return "L1A"
    return "RAW"


def _mission(item: dict[str, Any]) -> str:
    text = f"{item.get('collection', '')} {item.get('id', '')}".lower()
    if "sentinel-2" in text or "s2a" in text or "s2b" in text:
        return "Sentinel-2 MSI"
    if "sentinel-1" in text or "s1a" in text or "s1b" in text:
        return "Sentinel-1 SAR"
    if "landsat" in text or item.get("id", "").startswith(("LC08", "LC09", "LE07")):
        return "Landsat"
    return str(item.get("collection") or "Unknown satellite")


def _preferred_asset_sort_key(asset_key: str) -> tuple[int, str]:
    try:
        return (SATELLITE_ASSET_KEYS.index(asset_key), asset_key)
    except ValueError:
        return (len(SATELLITE_ASSET_KEYS), asset_key)


def _asset_format(asset_info: dict[str, Any]) -> str | None:
    href = str(asset_info.get("href") or "").lower()
    media_type = str(asset_info.get("type") or asset_info.get("media_type") or "").lower()
    if "tiff" in media_type or href.endswith((".tif", ".tiff")):
        if "cloud-optimized" in media_type or "profile=cloud-optimized" in media_type:
            return "COG"
        return "GEOTIFF"
    return None


def _select_assets(item: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    assets = item.get("assets", {}) or {}
    preferred = [
        (asset_key, asset_info)
        for asset_key, asset_info in assets.items()
        if asset_key in SATELLITE_ASSET_KEYS and _asset_format(asset_info)
    ]
    fallback = [
        (asset_key, asset_info)
        for asset_key, asset_info in assets.items()
        if asset_key not in SATELLITE_ASSET_KEYS and _asset_format(asset_info)
    ]
    selected = sorted(preferred, key=lambda row: _preferred_asset_sort_key(row[0]))
    selected.extend(sorted(fallback, key=lambda row: row[0]))
    return selected[:SATELLITE_MAX_ASSETS_PER_SCENE]


def _head_http_asset(client: httpx.Client, href: str) -> dict[str, Any]:
    try:
        resp = client.head(href)
        resp.raise_for_status()
        return {
            "content_length": int(resp.headers.get("content-length", "0") or 0),
            "content_type": resp.headers.get("content-type"),
            "etag": resp.headers.get("etag"),
            "last_modified": resp.headers.get("last-modified"),
        }
    except httpx.HTTPError:
        return {
            "content_length": 0,
            "content_type": None,
            "etag": None,
            "last_modified": None,
        }


def _head_s3_asset(href: str) -> dict[str, Any]:
    parsed = urlparse(href)
    if parsed.scheme != "s3" or not parsed.netloc:
        return {}
    region = os.environ.get("AWS_OPEN_DATA_REGION", "us-west-2")
    s3 = boto3.client(
        "s3",
        region_name=region,
        config=Config(signature_version=UNSIGNED),
    )
    try:
        resp = s3.head_object(Bucket=parsed.netloc, Key=parsed.path.lstrip("/"))
        return {
            "content_length": int(resp.get("ContentLength") or 0),
            "content_type": resp.get("ContentType"),
            "etag": resp.get("ETag"),
            "last_modified": resp.get("LastModified").isoformat() if resp.get("LastModified") else None,
        }
    except Exception:
        return {
            "content_length": 0,
            "content_type": None,
            "etag": None,
            "last_modified": None,
        }


def _asset_metadata(client: httpx.Client, href: str) -> dict[str, Any]:
    if href.startswith("http://") or href.startswith("https://"):
        return _head_http_asset(client, href)
    if href.startswith("s3://"):
        return _head_s3_asset(href)
    return {
        "content_length": 0,
        "content_type": None,
        "etag": None,
        "last_modified": None,
    }


def _heuristic_enrichment(item: dict[str, Any]) -> dict[str, Any]:
    cloud_cover = item.get("cloud_cover")
    mission = _mission(item)
    recommended_bands = [asset_key for asset_key, _ in _select_assets(item)]
    priority = "MEDIUM"
    if isinstance(cloud_cover, (int, float)):
        if cloud_cover <= 10:
            priority = "HIGH"
        elif cloud_cover > MAX_CLOUD_COVER:
            priority = "LOW"

    use_cases = ["satellite coverage tracking"]
    hazards = ["general geospatial context"]
    mission_l = mission.lower()
    if "sentinel-2" in mission_l or "landsat" in mission_l:
        use_cases.extend(["vegetation change", "burn scar screening", "flood context"])
        hazards.extend(["WILDFIRE", "FLOOD", "DROUGHT"])
    elif "sentinel-1" in mission_l:
        use_cases.extend(["flood extent", "surface deformation", "sea ice monitoring"])
        hazards.extend(["FLOOD", "LANDSLIDE"])

    summary = (
        f"{mission} {_processing_level(item)} scene {item.get('id')} acquired "
        f"{item.get('datetime') or 'at an unknown time'} over bbox {item.get('bbox')}; "
        f"cloud cover={cloud_cover if cloud_cover is not None else 'unknown'}%."
    )
    return {
        "summary": summary[:500],
        "mission": mission,
        "analytic_priority": priority,
        "recommended_bands": recommended_bands,
        "use_cases": use_cases[:6],
        "hazard_relevance": hazards[:6],
        "ontology_tags": [mission, item.get("collection"), _processing_level(item)],
        "confidence": 0.65,
        "llm_backend": "heuristic",
        "llm_model": None,
        "processed_at": _now_iso(),
    }


def _clean_string_list(value: Any, max_items: int = 8) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned: list[str] = []
    for item in value:
        if item is None:
            continue
        cleaned.append(str(item)[:120])
        if len(cleaned) >= max_items:
            break
    return cleaned


def _sanitize_enrichment(raw: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    priority = str(raw.get("analytic_priority") or fallback["analytic_priority"]).upper()
    if priority not in {"LOW", "MEDIUM", "HIGH"}:
        priority = fallback["analytic_priority"]
    confidence = raw.get("confidence", fallback["confidence"])
    if not isinstance(confidence, (int, float)):
        confidence = fallback["confidence"]
    confidence = max(0.0, min(1.0, float(confidence)))

    return {
        "summary": str(raw.get("summary") or fallback["summary"])[:500],
        "mission": str(raw.get("mission") or fallback["mission"])[:120],
        "analytic_priority": priority,
        "recommended_bands": _clean_string_list(raw.get("recommended_bands"), 8) or fallback["recommended_bands"],
        "use_cases": _clean_string_list(raw.get("use_cases"), 6) or fallback["use_cases"],
        "hazard_relevance": _clean_string_list(raw.get("hazard_relevance"), 6) or fallback["hazard_relevance"],
        "ontology_tags": _clean_string_list(raw.get("ontology_tags"), 8) or fallback["ontology_tags"],
        "confidence": confidence,
        "llm_backend": _llm.stats["backend"],
        "llm_model": _llm.stats["model"],
        "processed_at": _now_iso(),
    }


def _llm_enrichment(item: dict[str, Any]) -> dict[str, Any]:
    fallback = _heuristic_enrichment(item)
    prompt = {
        "task": "Enrich this STAC satellite scene for TerraCube Sentinel ontology ingestion.",
        "scene": {
            "id": item.get("id"),
            "catalog": item.get("catalog"),
            "collection": item.get("collection"),
            "datetime": item.get("datetime"),
            "bbox": item.get("bbox"),
            "cloud_cover": item.get("cloud_cover"),
            "processing_level": _processing_level(item),
            "asset_keys": sorted((item.get("assets") or {}).keys()),
        },
        "required_json_schema": {
            "summary": "one operational sentence, no invented facts",
            "mission": "satellite or sensor family",
            "analytic_priority": "LOW|MEDIUM|HIGH",
            "recommended_bands": ["asset keys useful for downstream analytics"],
            "use_cases": ["short analytic use cases"],
            "hazard_relevance": ["hazard categories if applicable"],
            "ontology_tags": ["compact tags"],
            "confidence": "0.0-1.0",
        },
    }
    system = (
        "You enrich satellite metadata for an ontology ingestion pipeline. "
        "Return JSON only. Do not infer active disasters from imagery metadata alone."
    )
    parsed = _llm.extract_json(json.dumps(prompt, default=str), system=system)
    if isinstance(parsed, dict):
        return _sanitize_enrichment(parsed, fallback)
    return fallback


def _object_id_from_response(data: Any) -> str | None:
    if not isinstance(data, dict):
        return None
    for key in ("id", "_id", "objectId"):
        if data.get(key):
            return str(data[key])
    nested = data.get("data")
    if isinstance(nested, dict):
        return _object_id_from_response(nested)
    return None


def _post_object(
    client: httpx.Client,
    headers: dict[str, str],
    object_type: str,
    properties: dict[str, Any],
) -> str | None:
    resp = client.post(
        "/objects",
        json={"objectType": object_type, "properties": properties},
        headers=headers,
    )
    resp.raise_for_status()
    return _object_id_from_response(resp.json())


def _copy_http_asset_to_minio(
    client: httpx.Client,
    s3: Any,
    asset_rec: dict[str, Any],
    object_key: str,
) -> None:
    href = asset_rec["source_href"]
    with client.stream("GET", href) as resp:
        resp.raise_for_status()
        with tempfile.TemporaryFile() as tmp:
            for chunk in resp.iter_bytes():
                tmp.write(chunk)
            tmp.seek(0)
            s3.upload_fileobj(
                tmp,
                MINIO_BUCKET,
                object_key,
                ExtraArgs={"ContentType": asset_rec.get("media_type") or "image/tiff"},
            )


# ── Assets ─────────────────────────────────────────────────────────────


@asset(group_name="satellite_ingestion", compute_kind="api")
def search_stac_catalogs() -> list[dict[str, Any]]:
    """Search STAC catalogs for recent scenes over the AOI."""
    log = get_dagster_logger()
    now = datetime.now(timezone.utc)
    started_at = (now - timedelta(hours=STAC_LOOKBACK_HOURS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    ended_at = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    date_range = f"{started_at}/{ended_at}"
    items: list[dict[str, Any]] = []

    for catalog in STAC_CATALOGS:
        try:
            client = STACClient.open(catalog["url"])
            search = client.search(
                collections=catalog["collections"],
                bbox=DEFAULT_AOI,
                datetime=date_range,
                max_items=STAC_MAX_ITEMS,
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


@asset(group_name="satellite_ingestion", compute_kind="ai", deps=[filter_scenes])
def enrich_stac_items_with_llm(filter_scenes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add compact LLM-derived analytic metadata before ontology load."""
    log = get_dagster_logger()
    enriched: list[dict[str, Any]] = []

    for idx, item in enumerate(filter_scenes):
        record = dict(item)
        if idx < SATELLITE_LLM_MAX_ITEMS:
            record["ai_enrichment"] = _llm_enrichment(item)
        else:
            record["ai_enrichment"] = _heuristic_enrichment(item)
        enriched.append(record)

    log.info(
        "Enriched %d STAC items (%d via LLM max, remainder heuristic)",
        len(enriched),
        min(len(enriched), SATELLITE_LLM_MAX_ITEMS),
    )
    return enriched


@asset(group_name="satellite_ingestion", compute_kind="download", deps=[enrich_stac_items_with_llm])
def download_cog_assets(enrich_stac_items_with_llm: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Resolve selected open COG/GeoTIFF assets without loading whole scenes into memory."""
    log = get_dagster_logger()
    downloaded: list[dict[str, Any]] = []

    with httpx.Client(timeout=30, follow_redirects=True) as client:
        for item in enrich_stac_items_with_llm:
            for asset_key, asset_info in _select_assets(item):
                href = asset_info.get("href", "")
                product_format = _asset_format(asset_info)
                if not href:
                    continue
                metadata = _asset_metadata(client, href)
                local_name = f"{item['id']}_{asset_key}.tif"
                downloaded.append({
                    "scene": item,
                    "item_id": item["id"],
                    "catalog": item.get("catalog"),
                    "collection": item.get("collection"),
                    "asset_key": asset_key,
                    "local_name": local_name,
                    "source_href": href,
                    "media_type": asset_info.get("type") or metadata.get("content_type"),
                    "format": product_format or "GEOTIFF",
                    "content_length": metadata.get("content_length", 0),
                    "etag": metadata.get("etag"),
                    "last_modified": metadata.get("last_modified"),
                    "stac_href": item.get("self_href"),
                    "datetime": item.get("datetime"),
                    "bbox": item.get("bbox"),
                    "cloud_cover": item.get("cloud_cover"),
                    "processing_level": _processing_level(item),
                    "ai_enrichment": item.get("ai_enrichment") or _heuristic_enrichment(item),
                })
                log.info(
                    "Resolved open asset %s (%s bytes, source=%s)",
                    local_name,
                    metadata.get("content_length", 0),
                    href,
                )

    log.info(f"Resolved {len(downloaded)} COG/GeoTIFF assets")
    return downloaded


@asset(group_name="satellite_ingestion", compute_kind="storage", deps=[download_cog_assets])
def store_in_minio(download_cog_assets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Store asset references, or copy COG assets into MinIO when explicitly configured."""
    log = get_dagster_logger()
    copy_assets = SATELLITE_ASSET_STORAGE_MODE == "copy"
    s3 = None

    if copy_assets:
        s3 = boto3.client(
            "s3",
            endpoint_url=MINIO_ENDPOINT,
            aws_access_key_id=MINIO_ACCESS_KEY,
            aws_secret_access_key=MINIO_SECRET_KEY,
        )
        try:
            s3.head_bucket(Bucket=MINIO_BUCKET)
        except Exception:
            try:
                s3.create_bucket(Bucket=MINIO_BUCKET)
            except Exception as exc:
                log.warning(f"Failed to create bucket: {exc}")

    stored: list[dict[str, Any]] = []
    with httpx.Client(timeout=120, follow_redirects=True) as client:
        for asset_rec in download_cog_assets:
            object_key = f"cog/{asset_rec['local_name']}"
            storage_path = asset_rec["source_href"]
            storage_mode = "EXTERNAL_OPEN_DATA"

            if copy_assets and asset_rec["source_href"].startswith(("http://", "https://")) and s3 is not None:
                try:
                    _copy_http_asset_to_minio(client, s3, asset_rec, object_key)
                    storage_path = f"s3://{MINIO_BUCKET}/{object_key}"
                    storage_mode = "MINIO_COPY"
                    log.info(f"Copied {object_key} into MinIO")
                except Exception as exc:
                    log.warning(
                        "MinIO copy failed for %s; keeping external open-data href: %s",
                        asset_rec["local_name"],
                        exc,
                    )

            stored.append({
                **asset_rec,
                "storage_path": storage_path,
                "storage_mode": storage_mode,
                "minio_object_key": object_key if storage_mode == "MINIO_COPY" else None,
            })

    log.info(f"Prepared {len(stored)} assets for ontology storage metadata")
    return stored


@asset(group_name="satellite_ingestion", compute_kind="api", deps=[store_in_minio])
def register_data_products(store_in_minio: list[dict[str, Any]]) -> dict[str, int]:
    """Register enriched SatellitePass/DataProduct ontology objects in Open Foundry."""
    log = get_dagster_logger()
    headers = {"Content-Type": "application/json"}
    if FOUNDRY_API_TOKEN:
        headers["Authorization"] = f"Bearer {FOUNDRY_API_TOKEN}"
    created = 0
    failed = 0
    linked = 0
    by_scene: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for asset_rec in store_in_minio:
        by_scene[asset_rec["item_id"]].append(asset_rec)

    with httpx.Client(timeout=30, base_url=FOUNDRY_API_URL) as client:
        for item_id, assets in by_scene.items():
            first = assets[0]
            enrichment = first.get("ai_enrichment") or {}
            scene = first.get("scene") or {}
            pass_props = {
                "acquisitionTime": first.get("datetime") or _now_iso(),
                "processingLevel": first.get("processing_level") or "RAW",
                "cloudCover": first.get("cloud_cover"),
                "stacItemUrl": first.get("stac_href"),
                "sourceCatalog": first.get("catalog"),
                "sourceSceneId": f"stac-{_stable_id(first.get('catalog'), item_id)}",
                "collection": first.get("collection"),
                "bbox": first.get("bbox"),
                "mission": enrichment.get("mission"),
                "aiSummary": enrichment.get("summary"),
                "aiAnalyticPriority": enrichment.get("analytic_priority"),
                "aiUseCases": enrichment.get("use_cases"),
                "aiHazardRelevance": enrichment.get("hazard_relevance"),
                "aiOntologyTags": enrichment.get("ontology_tags"),
                "aiConfidence": enrichment.get("confidence"),
                "aiModel": enrichment.get("llm_model"),
                "aiProcessedAt": enrichment.get("processed_at"),
                "openDataProvider": (
                    "AWS Open Data"
                    if first.get("catalog") == "Earth Search (AWS)"
                    else first.get("catalog")
                ),
                "rawStacItem": scene,
            }
            try:
                satellite_pass_id = _post_object(client, headers, "SatellitePass", pass_props)
                created += 1

                for asset_rec in assets:
                    source_asset_id = "stac-asset-" + _stable_id(
                        asset_rec.get("catalog"),
                        item_id,
                        asset_rec.get("asset_key"),
                        asset_rec.get("source_href"),
                    )
                    product_props = {
                        "name": asset_rec["local_name"],
                        "type": "RASTER",
                        "format": asset_rec.get("format") or "COG",
                        "storagePath": asset_rec.get("storage_path", ""),
                        "sizeBytes": asset_rec.get("content_length", 0),
                        "sourceHref": asset_rec.get("source_href"),
                        "sourceAssetId": source_asset_id,
                        "storageMode": asset_rec.get("storage_mode"),
                        "assetKey": asset_rec.get("asset_key"),
                        "sourceCatalog": asset_rec.get("catalog"),
                        "collection": asset_rec.get("collection"),
                        "etag": asset_rec.get("etag"),
                        "sourceLastModified": asset_rec.get("last_modified"),
                        "aiRecommended": asset_rec.get("asset_key") in enrichment.get("recommended_bands", []),
                    }
                    product_id = _post_object(client, headers, "DataProduct", product_props)
                    created += 1

                    if satellite_pass_id and product_id:
                        link_payload = {
                            "linkType": "Contains",
                            "from": satellite_pass_id,
                            "to": product_id,
                            "properties": {"bandName": asset_rec.get("asset_key")},
                        }
                        link_resp = client.post("/links", json=link_payload, headers=headers)
                        link_resp.raise_for_status()
                        linked += 1
            except httpx.HTTPError as exc:
                log.warning(f"Failed to register satellite scene {item_id}: {exc}")
                failed += 1

    log.info(f"Registered {created} ontology objects, {linked} links, {failed} scene failures")
    return {"created": created, "linked": linked, "failed": failed}


# ── Job ────────────────────────────────────────────────────────────────

satellite_ingestion_job = define_asset_job(
    name="satellite_ingestion_job",
    selection=AssetSelection.groups("satellite_ingestion"),
    description="Search STAC catalogs, enrich scenes, resolve open COGs, register in Foundry",
)
