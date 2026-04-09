"""
Fusion tools — unified situational awareness API.
get_situational_awareness(bbox, entity_types) → unified GeoJSON FeatureCollection.
"""

import os
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

FOUNDRY_API_URL = os.getenv("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_TOKEN = os.getenv("FOUNDRY_TOKEN", "")

ALL_ENTITY_TYPES = [
    "HazardEvent", "Aircraft", "Vessel", "SatellitePass",
    "FinancialIndicator", "ArmedConflict", "Airport", "Port",
    "InfrastructureAsset", "Sensor",
]


async def get_situational_awareness(
    bbox: tuple[float, float, float, float] | None = None,
    entity_types: list[str] | None = None,
    limit: int = 500,
) -> dict:
    """
    Get unified situational awareness as a GeoJSON FeatureCollection.

    Args:
        bbox: (min_lat, min_lng, max_lat, max_lng) bounding box filter
        entity_types: list of entity types to include (default: all)
        limit: max features per entity type

    Returns:
        GeoJSON FeatureCollection with all matching features
    """
    types_to_query = entity_types or ALL_ENTITY_TYPES
    features: list[dict] = []
    headers = {"Authorization": f"Bearer {FOUNDRY_TOKEN}"}

    async with httpx.AsyncClient(timeout=30.0, base_url=FOUNDRY_API_URL) as client:
        for entity_type in types_to_query:
            try:
                params: dict[str, Any] = {"objectType": entity_type, "pageSize": limit}
                if bbox:
                    params["bbox"] = f"{bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]}"
                resp = await client.get("/objects", params=params, headers=headers)
                resp.raise_for_status()
                data = resp.json().get("data", [])
                for obj in data:
                    geometry = obj.get("geometry") or obj.get("properties", {}).get("geometry")
                    props = obj.get("properties", obj)
                    props["entityType"] = entity_type
                    features.append({
                        "type": "Feature",
                        "geometry": geometry or {"type": "Point", "coordinates": [0, 0]},
                        "properties": props,
                    })
            except Exception as e:
                logger.warning("Failed to fetch %s: %s", entity_type, e)

    # Try loading from cache as fallback
    if not features:
        try:
            import sys as _sys, os as _os
            _sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.dirname(__file__))), "dagster"))
            from sources.cache import FusionCache
            cache = FusionCache()
            for entity_type in types_to_query:
                cached = cache.get_all(entity_type)
                features.extend(cached[:limit])
        except ImportError:
            pass

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "totalFeatures": len(features),
            "entityTypes": types_to_query,
            "bbox": list(bbox) if bbox else None,
        },
    }


async def get_entity_count_by_type() -> dict[str, int]:
    """Get count of entities by type for dashboard stats."""
    counts: dict[str, int] = {}
    headers = {"Authorization": f"Bearer {FOUNDRY_TOKEN}"}

    async with httpx.AsyncClient(timeout=30.0, base_url=FOUNDRY_API_URL) as client:
        for entity_type in ALL_ENTITY_TYPES:
            try:
                resp = await client.get(
                    "/objects", params={"objectType": entity_type, "pageSize": 1},
                    headers=headers,
                )
                resp.raise_for_status()
                total = resp.json().get("totalCount", 0)
                counts[entity_type] = total
            except Exception:
                counts[entity_type] = 0
    return counts
