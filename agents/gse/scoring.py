"""
Per-region composite GSE scoring with history and trend analysis.
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass

import httpx

from .engine import GlobalStabilityEngine, GSEEvent, GSEResult
from .threat_levels import ThreatLevel, get_threat_level
from .patterns import PatternDetector, PatternMatch

logger = logging.getLogger(__name__)

FOUNDRY_API_URL = os.getenv("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_TOKEN = os.getenv("FOUNDRY_TOKEN", "")

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
        headers = {"Authorization": f"Bearer {FOUNDRY_TOKEN}"}

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
                    severity = "CRITICAL" if fatalities > 10 else "HIGH" if fatalities > 0 else "MODERATE"
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

        # Generate synthetic events if none found (for demo)
        if not events:
            logger.warning(
                "No events fetched from Foundry API — using synthetic data. "
                "Set FOUNDRY_API_URL and ensure the API is running for real data."
            )
            events = self._synthetic_events()

        return events

    def _synthetic_events(self) -> list[GSEEvent]:
        """Generate synthetic events for demo/development."""
        now = datetime.now(timezone.utc)
        return [
            GSEEvent("ev-1", "natural_disaster", "HIGH", 0.9, now - timedelta(hours=2), "east-asia", "usgs", 35.7, 139.7),
            GSEEvent("ev-2", "conflict", "CRITICAL", 0.85, now - timedelta(hours=4), "middle-east", "acled", 33.3, 44.4),
            GSEEvent("ev-3", "political", "MODERATE", 0.7, now - timedelta(hours=6), "europe", "gdelt", 48.9, 2.4),
            GSEEvent("ev-4", "economic", "HIGH", 0.8, now - timedelta(hours=1), "north-america", "finance", 40.7, -74.0),
            GSEEvent("ev-5", "natural_disaster", "CRITICAL", 0.95, now - timedelta(hours=3), "south-asia", "firms", 20.6, 78.9),
            GSEEvent("ev-6", "health", "MODERATE", 0.6, now - timedelta(hours=12), "africa", "who", 9.1, 8.7),
            GSEEvent("ev-7", "conflict", "HIGH", 0.9, now - timedelta(hours=5), "middle-east", "acled", 34.8, 38.0),
            GSEEvent("ev-8", "terrorism", "CRITICAL", 0.75, now - timedelta(hours=8), "south-asia", "acled", 30.4, 69.3),
            GSEEvent("ev-9", "migration", "MODERATE", 0.65, now - timedelta(hours=10), "europe", "unhcr", 38.0, 23.7),
            GSEEvent("ev-10", "energy", "HIGH", 0.8, now - timedelta(hours=7), "europe", "iea", 51.5, -0.1),
        ]
