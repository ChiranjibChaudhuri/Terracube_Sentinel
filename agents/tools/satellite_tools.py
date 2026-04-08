from __future__ import annotations

import logging

import httpx

from config import FoundryConfig

logger = logging.getLogger(__name__)

# Public STAC catalog for Earth observation data
EARTH_SEARCH_URL = "https://earth-search.aws.element84.com/v1"


async def search_stac(
    bbox: list[float],
    datetime_range: str,
    collections: list[str] | None = None,
    max_cloud_cover: float = 20.0,
) -> list[dict]:
    """Search the Earth Search STAC catalog for satellite imagery.

    Args:
        bbox: Bounding box as ``[west, south, east, north]``.
        datetime_range: ISO-8601 datetime range (e.g. ``2024-01-01/2024-01-31``).
        collections: STAC collection IDs to search. Defaults to Sentinel-2 L2A.
        max_cloud_cover: Maximum cloud cover percentage (0-100).

    Returns:
        A list of STAC feature dicts.
    """
    if collections is None:
        collections = ["sentinel-2-l2a"]

    search_body: dict = {
        "bbox": bbox,
        "datetime": datetime_range,
        "collections": collections,
        "limit": 20,
        "query": {
            "eo:cloud_cover": {"lte": max_cloud_cover},
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{EARTH_SEARCH_URL}/search",
            json=search_body,
        )
        resp.raise_for_status()
        data = resp.json()

    features = data.get("features", [])
    return [
        {
            "id": f.get("id"),
            "datetime": f.get("properties", {}).get("datetime"),
            "cloud_cover": f.get("properties", {}).get("eo:cloud_cover"),
            "collection": f.get("collection"),
            "bbox": f.get("bbox"),
            "assets": list(f.get("assets", {}).keys()),
        }
        for f in features
    ]


async def get_coverage(
    region_id: str,
    foundry_config: FoundryConfig | None = None,
) -> dict:
    """Get satellite coverage statistics for a region.

    Queries the Open Foundry ontology for SatellitePass objects linked to
    the given region and computes basic coverage stats.

    Args:
        region_id: The ontology Region object ID.
        foundry_config: Optional Foundry connection configuration.

    Returns:
        A dict with coverage statistics.
    """
    config = foundry_config or FoundryConfig()
    headers: dict[str, str] = {"Accept": "application/json"}
    if config.token:
        headers["Authorization"] = f"Bearer {config.token}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{config.api_url}/links",
            headers=headers,
            params={
                "from": region_id,
                "linkType": "hasSatellitePass",
                "direction": "OUTBOUND",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    passes = data.get("data", data.get("links", []))
    total = len(passes)
    recent = [
        p for p in passes
        if p.get("properties", {}).get("status") == "completed"
    ]

    return {
        "region_id": region_id,
        "total_passes": total,
        "completed_passes": len(recent),
        "coverage_ratio": len(recent) / total if total > 0 else 0.0,
    }
