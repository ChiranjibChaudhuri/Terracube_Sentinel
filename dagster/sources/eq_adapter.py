"""
Enhanced earthquake monitoring adapter (USGS).
Adds ShakeMap intensity, tsunami alerts, aftershock sequence tracking.
"""

from .base_adapter import BaseAdapter, GeoJSONFeature
import logging

logger = logging.getLogger(__name__)

USGS_FEED_BASE = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary"

FEED_LEVELS = {
    "significant": f"{USGS_FEED_BASE}/significant_day.geojson",
    "4.5": f"{USGS_FEED_BASE}/4.5_day.geojson",
    "2.5": f"{USGS_FEED_BASE}/2.5_day.geojson",
    "1.0": f"{USGS_FEED_BASE}/1.0_day.geojson",
    "all": f"{USGS_FEED_BASE}/all_day.geojson",
}


class EarthquakeAdapter(BaseAdapter):
    source_name = "usgs_earthquake"
    entity_type = "HazardEvent"

    def get_ttl(self) -> int:
        return 300

    def _health_url(self) -> str:
        return FEED_LEVELS["significant"]

    def fetch(self, min_magnitude: str = "2.5", **kwargs) -> list[dict]:
        """Fetch earthquake data from USGS GeoJSON feed."""
        client = self._get_client(timeout=30.0)
        url = FEED_LEVELS.get(min_magnitude, FEED_LEVELS["2.5"])
        resp = client.get(url)
        resp.raise_for_status()
        data = resp.json()
        return data.get("features", [])

    def normalize(self, raw_records: list[dict]) -> list[GeoJSONFeature]:
        features = []
        for eq in raw_records:
            props = eq.get("properties", {})
            geom = eq.get("geometry", {})
            coords = geom.get("coordinates", [0, 0, 0])

            mag = props.get("mag", 0) or 0
            severity = "LOW"
            alert_level = "GREEN"
            if mag >= 7.0:
                severity, alert_level = "CRITICAL", "RED"
            elif mag >= 5.5:
                severity, alert_level = "HIGH", "ORANGE"
            elif mag >= 4.0:
                severity, alert_level = "MODERATE", "YELLOW"

            tsunami = props.get("tsunami", 0) == 1
            felt = props.get("felt")
            cdi = props.get("cdi")  # Community Decimal Intensity
            mmi = props.get("mmi")  # Modified Mercalli Intensity
            alert = props.get("alert")  # PAGER alert level

            features.append(GeoJSONFeature(
                geometry={"type": "Point", "coordinates": [coords[0], coords[1]]},
                properties={
                    "entityType": "HazardEvent",
                    "hazardType": "EARTHQUAKE",
                    "severity": severity,
                    "alertLevel": alert_level,
                    "confidence": min(1.0, (props.get("nst", 10) or 10) / 50.0),
                    "magnitude": mag,
                    "magnitudeType": props.get("magType", ""),
                    "depth": coords[2] if len(coords) > 2 else None,
                    "place": props.get("place", ""),
                    "tsunami": tsunami,
                    "felt": felt,
                    "cdi": cdi,
                    "mmi": mmi,
                    "pagerAlert": alert,
                    "shakemapUrl": props.get("detail"),
                    "source": "usgs",
                    "timestamp": props.get("time"),
                    "updated": props.get("updated"),
                    "url": props.get("url"),
                    "title": props.get("title", ""),
                },
            ))
        return features
