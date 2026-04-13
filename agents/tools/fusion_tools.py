"""
Fusion tools — unified situational awareness API.
get_situational_awareness(bbox, entity_types) → unified GeoJSON FeatureCollection.

Data flow: cache-first (Redis/Valkey), Foundry API as fallback.
"""

import json
import os
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

FOUNDRY_API_URL = os.getenv("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_TOKEN = os.getenv("FOUNDRY_TOKEN") or os.getenv("FOUNDRY_API_TOKEN", "")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

ALL_ENTITY_TYPES = [
    "HazardEvent", "Aircraft", "Vessel", "SatellitePass",
    "FinancialIndicator", "ArmedConflict", "Airport", "Port",
    "InfrastructureAsset", "Sensor",
]


def _foundry_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {FOUNDRY_TOKEN}"} if FOUNDRY_TOKEN else {}


def _read_cache(entity_types, limit=500):
    """Read cached entities directly from Redis/Valkey."""
    try:
        import redis
        client = redis.from_url(REDIS_URL, decode_responses=True)
        features = []
        for entity_type in entity_types:
            pattern = f"fusion:{entity_type}:*"
            cursor = 0
            keys = []
            iterations = 0
            while iterations < 100:
                cursor, batch = client.scan(cursor, match=pattern, count=100)
                keys.extend(batch)
                iterations += 1
                if cursor == 0:
                    break
            if keys:
                values = client.mget(keys[:limit])
                for v in values:
                    if v:
                        try:
                            feat = json.loads(v)
                            props = feat.get("properties", feat)
                            props["entityType"] = entity_type
                            features.append({
                                "type": "Feature",
                                "geometry": feat.get("geometry", {"type": "Point", "coordinates": [0, 0]}),
                                "properties": props,
                            })
                        except (json.JSONDecodeError, TypeError):
                            pass
        client.close()
        return features
    except Exception as e:
        logger.warning("Cache read failed: %s", e)
        return []


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

    # 1. Try cache first (fast, always available when pipelines run)
    features = _read_cache(types_to_query, limit)

    # 2. If cache empty, try Foundry API as fallback
    if not features:
        headers = _foundry_headers()
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
                    logger.warning("Failed to fetch %s from Foundry: %s", entity_type, e)

    # 3. Return FeatureCollection
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
    headers = _foundry_headers()

    async with httpx.AsyncClient(timeout=30.0, base_url=FOUNDRY_API_URL) as client:
        for entity_type in ALL_ENTITY_TYPES:
            try:
                resp = await client.get(
                    "/objects", params={"objectType": entity_type, "pageSize": 1},
                    headers=headers,
                )
                resp.raise_for_status()
                payload = resp.json()
                total = payload.get("total")
                if total is None:
                    total = payload.get("totalCount", 0)
                counts[entity_type] = total
            except Exception:
                counts[entity_type] = 0
    return counts
