"""Satellite tools — STAC search and coverage analysis."""

from __future__ import annotations

import httpx


STAC_URL = "https://earth-search.aws.element84.com/v1"


async def search_stac(
    bbox: list[float],
    datetime_range: str,
    collections: list[str] | None = None,
    max_cloud_cover: float = 20.0,
) -> list[dict]:
    """Search the STAC catalog for satellite imagery.

    Parameters
    ----------
    bbox: [west, south, east, north]
    datetime_range: ISO 8601 interval, e.g. "2026-04-01T00:00:00Z/2026-04-08T00:00:00Z"
    collections: STAC collection IDs (default: sentinel-2-l2a)
    max_cloud_cover: maximum cloud cover percentage
    """
    if collections is None:
        collections = ["sentinel-2-l2a"]

    body = {
        "bbox": bbox,
        "datetime": datetime_range,
        "collections": collections,
        "limit": 50,
        "query": {"eo:cloud_cover": {"lte": max_cloud_cover}},
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(f"{STAC_URL}/search", json=body)
        resp.raise_for_status()
        data = resp.json()
        return [
            {
                "id": feat["id"],
                "collection": feat.get("collection"),
                "datetime": feat.get("properties", {}).get("datetime"),
                "cloud_cover": feat.get("properties", {}).get("eo:cloud_cover"),
                "bbox": feat.get("bbox"),
            }
            for feat in data.get("features", [])
        ]


async def get_coverage(region_id: str) -> dict:
    """Get satellite coverage statistics for a region (stub)."""
    return {
        "region_id": region_id,
        "total_passes_30d": 0,
        "avg_cloud_cover": 0.0,
        "last_clear_pass": None,
        "note": "Coverage analysis requires spatial index — not yet implemented",
    }
