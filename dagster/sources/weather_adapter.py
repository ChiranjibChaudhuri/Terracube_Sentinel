"""
Multi-source weather fusion adapter.
Combines NWS alerts, tropical cyclone tracking, and severe weather data.
"""

from .base_adapter import BaseAdapter, GeoJSONFeature
import logging

logger = logging.getLogger(__name__)

NWS_ALERTS_URL = "https://api.weather.gov/alerts/active"
IBTRACS_URL = "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.last3years.list.v04r01.csv"


class WeatherAlertAdapter(BaseAdapter):
    source_name = "weather_alerts"
    entity_type = "HazardEvent"

    def get_ttl(self) -> int:
        return 300

    def _health_url(self) -> str:
        return NWS_ALERTS_URL

    def fetch(self, **kwargs) -> list[dict]:
        """Fetch active NWS weather alerts."""
        client = self._get_client(timeout=30.0)
        headers = {"User-Agent": "TerraCube-Sentinel/1.0", "Accept": "application/geo+json"}
        resp = client.get(NWS_ALERTS_URL, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data.get("features", [])

    def normalize(self, raw_records: list[dict]) -> list[GeoJSONFeature]:
        features = []
        for alert in raw_records:
            props = alert.get("properties", {})
            geom = alert.get("geometry")

            severity_map = {
                "Extreme": ("CRITICAL", "RED"),
                "Severe": ("HIGH", "ORANGE"),
                "Moderate": ("MODERATE", "YELLOW"),
                "Minor": ("LOW", "GREEN"),
            }
            sev_label = props.get("severity", "Minor")
            severity, alert_level = severity_map.get(sev_label, ("LOW", "GREEN"))

            event_type = props.get("event", "")
            hazard_type = self._classify_weather_hazard(event_type)

            if geom is None:
                geom = {"type": "Point", "coordinates": [0, 0]}

            features.append(GeoJSONFeature(
                geometry=geom,
                properties={
                    "entityType": "HazardEvent",
                    "hazardType": hazard_type,
                    "severity": severity,
                    "alertLevel": alert_level,
                    "confidence": 0.95,
                    "event": event_type,
                    "headline": props.get("headline", ""),
                    "description": (props.get("description", ""))[:500],
                    "instruction": (props.get("instruction", "") or "")[:300],
                    "urgency": props.get("urgency", ""),
                    "certainty": props.get("certainty", ""),
                    "areaDesc": props.get("areaDesc", ""),
                    "effective": props.get("effective"),
                    "expires": props.get("expires"),
                    "source": "nws",
                    "timestamp": props.get("sent"),
                },
            ))
        return features

    @staticmethod
    def _classify_weather_hazard(event: str) -> str:
        event_lower = event.lower()
        if any(w in event_lower for w in ["tornado", "hurricane", "typhoon", "cyclone", "storm"]):
            return "STORM"
        if any(w in event_lower for w in ["flood", "flash flood"]):
            return "FLOOD"
        if any(w in event_lower for w in ["fire", "red flag"]):
            return "WILDFIRE"
        if "tsunami" in event_lower:
            return "TSUNAMI"
        if any(w in event_lower for w in ["volcano", "ash"]):
            return "VOLCANIC"
        if "drought" in event_lower:
            return "DROUGHT"
        if "landslide" in event_lower:
            return "LANDSLIDE"
        return "STORM"
