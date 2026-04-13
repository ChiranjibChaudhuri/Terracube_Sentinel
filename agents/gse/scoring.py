"""
Per-region composite GSE scoring with history and trend analysis.
"""

import os
import logging
from datetime import datetime, timezone

import httpx

from .engine import GlobalStabilityEngine, GSEEvent, GSEResult
from .patterns import PatternDetector, PatternMatch

logger = logging.getLogger(__name__)

FOUNDRY_API_URL = os.getenv("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_TOKEN = os.getenv("FOUNDRY_TOKEN") or os.getenv("FOUNDRY_API_TOKEN", "")


def _foundry_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {FOUNDRY_TOKEN}"} if FOUNDRY_TOKEN else {}

# Map hazard types and event types to GSE categories
HAZARD_TO_CATEGORY = {
    "EARTHQUAKE": "natural_disaster",
    "FLOOD": "natural_disaster",
    "WILDFIRE": "natural_disaster",
    "STORM": "natural_disaster",
    "VOLCANIC": "natural_disaster",
    "LANDSLIDE": "natural_disaster",
    "TSUNAMI": "natural_disaster",
    "DROUGHT": "natural_disaster",
}

CONFLICT_TO_CATEGORY = {
    "BATTLE": "conflict",
    "EXPLOSION": "terrorism",
    "PROTEST": "political",
    "RIOT": "political",
    "VIOLENCE_AGAINST_CIVILIANS": "conflict",
    "STRATEGIC_DEVELOPMENT": "political",
}


class GSEScorer:
    """Orchestrates GSE computation across all regions."""

    def __init__(self):
        self.engine = GlobalStabilityEngine(recency_half_life_hours=24.0)
        self.pattern_detector = PatternDetector()

    async def compute_all_regions(self) -> list[GSEResult]:
        """Compute GSE for all known regions."""
        events = await self._fetch_events()
        region_ids = set(e.region_id for e in events)
        results = []
        for region_id in region_ids:
            result = self.engine.compute_gse(region_id, events)
            results.append(result)
        results.sort(key=lambda r: r.gse_score, reverse=True)
        return results

    async def compute_region(self, region_id: str) -> GSEResult:
        """Compute GSE for a specific region."""
        events = await self._fetch_events()
        return self.engine.compute_gse(region_id, events)

    async def detect_patterns(self, region_id: str | None = None) -> list[PatternMatch]:
        """Detect patterns across events."""
        events = await self._fetch_events()
        return self.pattern_detector.detect_all(events, region_id)

    def get_contributing_factors(self, result: GSEResult) -> list[dict]:
        """Get detailed contributing factors for a GSE result."""
        return [
            {
                "category": f.category,
                "eventCount": f.event_count,
                "pressure": round(f.pressure, 3),
                "weight": f.weight,
                "weightedPressure": round(f.pressure * f.weight, 3),
            }
            for f in result.contributing_factors
        ]

    def generate_gse_history(self, region_id: str, days: int = 30) -> list[dict]:
        """Get GSE score time series for trending."""
        return self.engine.get_history(region_id, days)

    async def _fetch_events(self) -> list[GSEEvent]:
        """Fetch events from Foundry and convert to GSEEvent objects."""
        events: list[GSEEvent] = []
        headers = _foundry_headers()

        async with httpx.AsyncClient(timeout=30.0, base_url=FOUNDRY_API_URL) as client:
            # Fetch hazard events
            try:
                resp = await client.get(
                    "/objects",
                    params={"objectType": "HazardEvent", "pageSize": 500},
                    headers=headers,
                )
                resp.raise_for_status()
                for obj in resp.json().get("data", []):
                    props = obj.get("properties", obj)
                    geom = obj.get("geometry", {})
                    coords = geom.get("coordinates", [0, 0])
                    ht = props.get("hazardType", props.get("type", ""))
                    category = HAZARD_TO_CATEGORY.get(ht, "natural_disaster")
                    ts = props.get("startTime", props.get("timestamp", ""))
                    try:
                        timestamp = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        timestamp = datetime.now(timezone.utc)
                    events.append(GSEEvent(
                        event_id=props.get("id", ""),
                        category=category,
                        severity=props.get("severity", "LOW"),
                        confidence=float(props.get("confidence", 0.5)),
                        timestamp=timestamp,
                        region_id=props.get("region_id", "GLOBAL"),
                        source=props.get("source", ""),
                        latitude=coords[1] if len(coords) > 1 else 0,
                        longitude=coords[0] if len(coords) > 0 else 0,
                    ))
            except Exception as e:
                logger.warning("Failed to fetch hazard events: %s", e)

            # Fetch armed conflicts
            try:
                resp = await client.get(
                    "/objects",
                    params={"objectType": "ArmedConflict", "pageSize": 500},
                    headers=headers,
                )
                resp.raise_for_status()
                for obj in resp.json().get("data", []):
                    props = obj.get("properties", obj)
                    geom = obj.get("geometry", {})
                    coords = geom.get("coordinates", [0, 0])
                    et = props.get("eventType", "")
                    category = CONFLICT_TO_CATEGORY.get(et, "conflict")
                    ts = props.get("date", "")
                    try:
                        timestamp = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        timestamp = datetime.now(timezone.utc)
                    fatalities = int(props.get("fatalities", 0) or 0)
                    severity = "CRITICAL" if fatalities > 10 else "HIGH" if fatalities > 0 else "LOW"
                    events.append(GSEEvent(
                        event_id=props.get("eventId", ""),
                        category=category,
                        severity=severity,
                        confidence=0.8,
                        timestamp=timestamp,
                        region_id=props.get("region_id", "GLOBAL"),
                        source=props.get("source", ""),
                        latitude=coords[1] if len(coords) > 1 else 0,
                        longitude=coords[0] if len(coords) > 0 else 0,
                    ))
            except Exception as e:
                logger.warning("Failed to fetch armed conflicts: %s", e)

        if not events:
            logger.info("No GSE events fetched from Foundry API")

        return events
