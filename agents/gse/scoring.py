"""
Per-region composite GSE scoring with history and trend analysis.
Uses Foundry as primary source, GDELT GKG as OSINT fallback.
"""

import os
import hashlib
import logging
from datetime import datetime, timezone

import httpx

from .engine import GlobalStabilityEngine, GSEEvent, GSEResult
from .patterns import PatternDetector, PatternMatch

logger = logging.getLogger(__name__)

FOUNDRY_API_URL = os.getenv("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_TOKEN = os.getenv("FOUNDRY_TOKEN") or os.getenv("FOUNDRY_API_TOKEN", "")
GDELT_GKG_URL = os.getenv(
    "GDELT_GKG_URL",
    "https://api.gdeltproject.org/api/v2/doc/doc",
)

# Country code → approximate lat/lng (for GDELT events that lack coordinates)
_COUNTRY_CENTROIDS: dict[str, tuple[float, float]] = {
    "IR": (32.4, 53.7), "IL": (31.0, 34.8), "LB": (33.9, 35.9), "SY": (35.0, 38.9),
    "IQ": (33.2, 43.7), "YE": (15.6, 48.5), "UA": (48.4, 31.2), "RU": (61.5, 105.3),
    "US": (39.8, -98.6), "CN": (35.9, 104.2), "GB": (52.2, -1.2), "FR": (46.2, 2.2),
    "DE": (51.2, 10.4), "JP": (36.2, 138.3), "IN": (20.6, 78.9), "BR": (-14.2, -51.9),
    "AU": (-25.3, 133.8), "ZA": (-30.6, 22.9), "NG": (9.1, 8.7), "EG": (26.8, 30.8),
    "SA": (23.9, 45.1), "TR": (38.9, 35.2), "PK": (30.4, 69.3), "KR": (35.9, 127.8),
    "CA": (56.1, -106.3), "MX": (23.6, -102.6), "ID": (-0.8, 113.9),
    "MY": (4.2, 101.9), "TH": (15.9, 100.9), "PH": (12.9, 121.8),
    "AF": (33.9, 67.7), "SO": (5.2, 46.2), "ET": (9.1, 40.5),
    "SD": (12.9, 30.2), "LY": (26.3, 17.2), "TN": (33.9, 9.5),
    "DZ": (28.0, 1.7), "MA": (31.8, -7.1), "JO": (30.6, 36.6),
    "PS": (31.9, 35.2), "GB": (52.2, -1.2),
}

# Map GDELT tone to severity
_GDELT_TONE_TO_SEVERITY: dict[str, str] = {
    "highly_negative": "HIGH",
    "negative": "MODERATE",
    "neutral": "LOW",
    "positive": "LOW",
}

# GDELT themes to GSE categories
_GDELT_THEME_MAP: dict[str, str] = {
    "TAX_BATTLE_CONFLICT": "conflict",
    "TAX_MILITARY": "conflict",
    "TAX_TERRORISM": "terrorism",
    "TAX_PROTEST": "political",
    "TAX_REBEL": "conflict",
    "TAX_GOVERNANCE": "political",
    "TAX_ECONOMICS": "economic",
    "TAX_NATURAL_DISASTER": "natural_disaster",
    "TAX_HEALTH": "health",
    "TAX_CYBER": "cyber",
    "TAX_MIGRATION": "migration",
    "TAX_ENERGY": "energy",
    "TAX_ENVIRONMENT": "environmental",
    "TAX_WEATHER": "natural_disaster",
    "TAX_EARTHQUAKE": "natural_disaster",
    "TAX_FLOOD": "natural_disaster",
    "TAX_WILDFIRE": "natural_disaster",
    "TAX_STORM": "natural_disaster",
    "TAX_DISEASE": "health",
    "TAX_NUCLEAR": "conflict",
}


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
        """Fetch events from Foundry (primary) and GDELT (fallback)."""
        events = await self._fetch_from_foundry()

        # If Foundry returned nothing, fall back to GDELT GKG OSINT feed
        if not events:
            events = await self._fetch_from_gdelt()

        if not events:
            logger.info("No GSE events fetched from any source")

        return events

    async def _fetch_from_foundry(self) -> list[GSEEvent]:
        """Fetch events from Foundry /objects API."""
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

        return events

    async def _fetch_from_gdelt(self) -> list[GSEEvent]:
        """
        Fetch recent events from GDELT GKG API as OSINT fallback.
        Uses the free GDELT GKG document API (no key required, rate-limited to 1 req/5s).
        """
        events: list[GSEEvent] = []
        now = datetime.now(timezone.utc)

        # Query for recent conflict-related articles (one query, keep it simple to avoid rate limit)
        queries = ["conflict OR attack OR military OR terrorism OR earthquake OR flood OR protest"]

        try:
            import asyncio
            async with httpx.AsyncClient(timeout=30.0) as client:
                for i, query in enumerate(queries):
                    if i > 0:
                        await asyncio.sleep(6)  # GDELT rate limit: 1 req / 5 seconds
                    try:
                        resp = await client.get(GDELT_GKG_URL, params={
                            "query": query,
                            "mode": "ArtList",
                            "maxrecords": 75,
                            "format": "json",
                            "timespan": "7d",
                            "sourcelang": "english",
                        })
                        if resp.status_code == 429:
                            logger.info("GDELT rate limited, stopping")
                            break
                        resp.raise_for_status()
                        data = resp.json()
                        articles = data.get("articles", [])
                    except Exception as e:
                        logger.debug("GDELT fetch failed for '%s': %s", query, e)
                        continue

                    for article in articles:
                        url = article.get("url", "")
                        title = article.get("title", "")
                        if not url:
                            continue

                        # Generate a stable event ID from the URL
                        event_id = hashlib.md5(url.encode()).hexdigest()[:12]

                        # Extract GSE category from GDELT themes
                        themes = article.get("themes", "").split(",")
                        category = "political"  # default
                        for theme in themes:
                            theme = theme.strip()
                            if theme in _GDELT_THEME_MAP:
                                category = _GDELT_THEME_MAP[theme]
                                break

                        # Determine severity from tone
                        tone = article.get("septimes_tone", 0.0)
                        if isinstance(tone, str):
                            try:
                                tone = float(tone)
                            except ValueError:
                                tone = 0.0
                        if tone < -5:
                            severity = "HIGH"
                        elif tone < -2:
                            severity = "MODERATE"
                        else:
                            severity = "LOW"

                        # Extract coordinates or use country centroid
                        lat = article.get("coordinates_lat", 0.0)
                        lng = article.get("coordinates_lng", 0.0)
                        if not lat or not lng:
                            # Try to map country code from URL or title
                            for cc, (clat, clng) in _COUNTRY_CENTROIDS.items():
                                country_name = article.get("sourcecountry", "")
                                if cc.upper() == country_name or cc in url or cc in title.upper():
                                    lat, lng = clat, clng
                                    break
                            else:
                                lat, lng = 0.0, 0.0

                        # Determine region from sourcecountry
                        sourcecountry = article.get("sourcecountry", "")
                        region_id = sourcecountry if sourcecountry else "GLOBAL"
                        # Map to our region IDs
                        if region_id in ("IR", "IQ", "SY", "YE", "SA", "AE", "JO", "LB", "IL", "TR", "PS"):
                            region_id = "middle-east"
                        elif region_id in ("UA", "RU"):
                            region_id = "europe"
                        elif region_id in ("CN", "JP", "KR", "IN", "PK", "ID"):
                            region_id = "east-asia"
                        elif region_id in ("NG", "ZA", "EG", "ET", "KE"):
                            region_id = "africa"
                        elif region_id in ("US", "CA", "MX"):
                            region_id = "north-america"
                        elif region_id in ("BR", "AR", "CO"):
                            region_id = "south-america"
                        elif region_id in ("AU", "NZ"):
                            region_id = "oceania"
                        else:
                            region_id = "GLOBAL"

                        # Parse date
                        date_str = article.get("septimes_date", "")
                        try:
                            timestamp = datetime.strptime(date_str, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
                        except (ValueError, TypeError):
                            timestamp = now

                        events.append(GSEEvent(
                            event_id=f"gdelt-{event_id}",
                            category=category,
                            severity=severity,
                            confidence=0.6,
                            timestamp=timestamp,
                            region_id=region_id,
                            source="gdelt",
                            latitude=lat,
                            longitude=lng,
                        ))

        except Exception as e:
            logger.warning("GDELT OSINT fallback failed: %s", e)

        # If GDELT also failed, use synthetic events for known active zones
        if not events:
            events = self._generate_synthetic_events()

        logger.info("GDELT/synthetic fallback: %d events", len(events))
        return events

    def _generate_synthetic_events(self) -> list[GSEEvent]:
        """Generate synthetic events for known active conflict/hazard zones.
        Used as ultimate fallback when both Foundry and GDELT are unavailable."""
        now = datetime.now(timezone.utc)
        events = []

        # Known active conflict zones (as of 2026)
        # (region_id, category, severity, count, lat, lng)
        synthetic_zones = [
            ("middle-east", "conflict", "HIGH", 8, 32.4, 53.7),    # Iran-Israel tensions
            ("middle-east", "conflict", "HIGH", 6, 33.9, 35.9),   # Lebanon/Hezbollah
            ("middle-east", "conflict", "HIGH", 5, 31.0, 34.8),   # Israel-Gaza
            ("middle-east", "conflict", "MODERATE", 4, 35.0, 38.9), # Syria
            ("middle-east", "conflict", "MODERATE", 3, 30.6, 36.6), # Jordan border
            ("middle-east", "terrorism", "MODERATE", 3, 15.6, 48.5), # Yemen/Houthis
            ("middle-east", "political", "LOW", 2, 23.9, 45.1),   # Saudi domestic
            ("middle-east", "cyber", "MODERATE", 2, 32.4, 53.7),   # Iran cyber ops
            ("europe", "conflict", "HIGH", 8, 48.4, 31.2),          # Ukraine-Russia front
            ("europe", "conflict", "MODERATE", 4, 55.7, 37.6),      # Russia-Ukraine border
            ("europe", "political", "LOW", 2, 61.5, 105.3),        # Russia domestic
            ("africa", "conflict", "HIGH", 7, 5.2, 46.2),          # Sudan civil war
            ("africa", "conflict", "MODERATE", 4, 12.9, 30.2),     # Sudan-South Sudan
            ("africa", "conflict", "MODERATE", 3, 9.1, 8.7),        # Nigeria/Boko Haram
            ("africa", "conflict", "LOW", 2, 7.5, 28.3),           # DRC
            ("africa", "political", "LOW", 2, 8.0, -1.0),         # Ghana/West Africa
            ("south-asia", "conflict", "MODERATE", 3, 33.9, 67.7),  # Pakistan-Afghanistan
            ("south-asia", "political", "LOW", 2, 28.6, 84.1),     # Nepal
            ("east-asia", "political", "MODERATE", 3, 35.9, 104.2), # China tensions
            ("east-asia", "conflict", "LOW", 2, 25.0, 102.0),      # Myanmar
            ("north-america", "political", "LOW", 1, 19.4, -99.1),  # Mexico cartels
            ("south-america", "conflict", "LOW", 2, 4.6, -74.1),    # Colombia
        ]

        for i, (region_id, category, severity, count, lat, lng) in enumerate(synthetic_zones):
            for j in range(count):
                # Spread events over the last 24 hours for realistic recent window
                hours_ago = (i * 2 + j * 3) % 24
                ts = now - __import__('datetime').timedelta(hours=hours_ago)
                events.append(GSEEvent(
                    event_id=f"synthetic-{region_id}-{category}-{i}-{j}",
                    category=category,
                    severity=severity,
                    confidence=0.5,
                    timestamp=ts,
                    region_id=region_id,
                    source="synthetic",
                    latitude=lat + (j * 0.5 - count * 0.25),
                    longitude=lng + (j * 0.5 - count * 0.25),
                ))

        return events
