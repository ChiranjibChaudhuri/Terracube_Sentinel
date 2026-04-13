"""
Redis-backed cache with per-entity-type TTL.
Uses Valkey (Redis-compatible) from the docker-compose stack.
"""

import json
import os
import logging

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Per-entity-type TTL in seconds (from OSINT-GEO pattern)
ENTITY_TTL: dict[str, int] = {
    "Aircraft": 120,
    "Vessel": 900,
    "HazardEvent": 300,
    "SatellitePass": 300,
    "WeatherAlert": 300,
    "FinancialIndicator": 600,
    "ArmedConflict": 3600,
    "Displacement": 86400,
    "Port": 86400,
    "Airport": 86400,
    "InfrastructureAsset": 86400,
    "SocialSignal": 3600,
}

DEFAULT_TTL = 300

# Maximum SCAN iterations to prevent infinite loops
MAX_SCAN_ITERATIONS = 1000


class FusionCache:
    """Redis-backed cache with per-entity TTL."""

    def __init__(self, redis_url: str | None = None):
        self._redis_url = redis_url or REDIS_URL
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                import redis
                self._client = redis.from_url(self._redis_url, decode_responses=True)
            except ImportError:
                logger.warning("redis package not installed — cache disabled")
                return None
            except Exception as e:
                logger.warning("Failed to connect to Redis: %s — cache disabled", e)
                return None
        return self._client

    def _key(self, entity_type: str, entity_id: str) -> str:
        return f"fusion:{entity_type}:{entity_id}"

    def get(self, entity_type: str, entity_id: str) -> dict | None:
        client = self._get_client()
        if client is None:
            return None
        try:
            data = client.get(self._key(entity_type, entity_id))
            return json.loads(data) if data else None
        except Exception:
            return None

    def set(self, entity_type: str, entity_id: str, data: dict, ttl: int | None = None) -> None:
        client = self._get_client()
        if client is None:
            return
        ttl = ttl or ENTITY_TTL.get(entity_type, DEFAULT_TTL)
        try:
            client.setex(
                self._key(entity_type, entity_id),
                ttl,
                json.dumps(data, default=str),
            )
        except Exception as e:
            logger.warning("Cache set failed: %s", e)

    def get_all(self, entity_type: str) -> list[dict]:
        client = self._get_client()
        if client is None:
            return []
        try:
            pattern = f"fusion:{entity_type}:*"
            keys: list[str] = []
            cursor = 0
            iterations = 0
            while True:
                cursor, batch = client.scan(cursor, match=pattern, count=100)
                keys.extend(batch)
                iterations += 1
                if cursor == 0 or iterations >= MAX_SCAN_ITERATIONS:
                    if iterations >= MAX_SCAN_ITERATIONS:
                        logger.warning("SCAN iteration limit reached for pattern %s (%d keys found)", pattern, len(keys))
                    break
            if not keys:
                return []
            values = client.mget(keys)
            return [json.loads(v) for v in values if v]
        except Exception:
            return []

    def flush_entity_type(self, entity_type: str) -> int:
        client = self._get_client()
        if client is None:
            return 0
        try:
            pattern = f"fusion:{entity_type}:*"
            keys: list[str] = []
            cursor = 0
            iterations = 0
            while True:
                cursor, batch = client.scan(cursor, match=pattern, count=100)
                keys.extend(batch)
                iterations += 1
                if cursor == 0 or iterations >= MAX_SCAN_ITERATIONS:
                    if iterations >= MAX_SCAN_ITERATIONS:
                        logger.warning("SCAN iteration limit reached for flush pattern %s", pattern)
                    break
            if keys:
                return client.delete(*keys)
            return 0
        except Exception:
            return 0

    def close(self) -> None:
        """Close the Redis connection."""
        if self._client is not None:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None
