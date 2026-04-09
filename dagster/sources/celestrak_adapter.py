"""
CelesTrak satellite orbital tracking adapter.
Parses TLE data and propagates orbits for satellite pass tracking.
"""

from .base_adapter import BaseAdapter, GeoJSONFeature
import httpx
import logging
import math
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php"

# Key satellite groups for Earth observation
SATELLITE_GROUPS = [
    "active",         # All active satellites (large)
    "weather",        # Weather satellites
    "resource",       # Earth resources
    "science",        # Science satellites
]


class CelesTrakAdapter(BaseAdapter):
    source_name = "celestrak"
    entity_type = "SatellitePass"

    def get_ttl(self) -> int:
        return 300

    def _health_url(self) -> str:
        return "https://celestrak.org"

    def fetch(self, group: str = "weather", **kwargs) -> list[dict]:
        """Fetch TLE data from CelesTrak in JSON format."""
        client = self._get_client(timeout=30.0)
        params = {"GROUP": group, "FORMAT": "json"}
        resp = client.get(CELESTRAK_URL, params=params)
        resp.raise_for_status()
        return resp.json()

    def normalize(self, raw_records: list[dict]) -> list[GeoJSONFeature]:
        features = []
        now = datetime.now(timezone.utc)
        for sat in raw_records:
            name = sat.get("OBJECT_NAME", "UNKNOWN")
            norad_id = sat.get("NORAD_CAT_ID", "")
            inclination = sat.get("INCLINATION", 0)
            period = sat.get("PERIOD")
            mean_motion = sat.get("MEAN_MOTION", 0)
            epoch = sat.get("EPOCH", "")

            # Approximate current position from mean elements
            ra = sat.get("RA_OF_ASC_NODE", 0)
            mean_anomaly = sat.get("MEAN_ANOMALY", 0)
            eccentricity = sat.get("ECCENTRICITY", 0)

            # Simplified ground track approximation
            lng, lat = self._approx_ground_track(
                ra, inclination, mean_anomaly, mean_motion, epoch, now
            )

            features.append(GeoJSONFeature(
                geometry={"type": "Point", "coordinates": [lng, lat]},
                properties={
                    "entityType": "SatellitePass",
                    "name": name,
                    "noradId": str(norad_id),
                    "inclination": inclination,
                    "period": period,
                    "meanMotion": mean_motion,
                    "eccentricity": eccentricity,
                    "epoch": epoch,
                    "source": "celestrak",
                    "timestamp": now.isoformat(),
                },
            ))
        return features

    @staticmethod
    def _approx_ground_track(ra: float, inc: float, ma: float,
                              mm: float, epoch: str, now: datetime) -> tuple[float, float]:
        """Simplified ground track approximation from orbital elements."""
        try:
            epoch_dt = datetime.fromisoformat(epoch.replace("Z", "+00:00"))
            dt_minutes = (now - epoch_dt).total_seconds() / 60.0
        except (ValueError, TypeError):
            dt_minutes = 0.0

        current_ma = (ma + mm * 360.0 * dt_minutes / 1440.0) % 360.0
        true_anomaly = current_ma  # Simplified: assume circular orbit

        lat = math.degrees(math.asin(
            math.sin(math.radians(inc)) * math.sin(math.radians(true_anomaly))
        ))
        # Approximate longitude from RAAN and Earth rotation
        earth_rotation_deg = dt_minutes * 360.0 / 1440.0
        lng = (ra + true_anomaly - earth_rotation_deg) % 360.0
        if lng > 180:
            lng -= 360

        lat = max(-90, min(90, lat))
        lng = max(-180, min(180, lng))
        return lng, lat
