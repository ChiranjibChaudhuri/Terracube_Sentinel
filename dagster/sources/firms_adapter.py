"""
Enhanced NASA FIRMS fire detection adapter.
Adds confidence scoring, fire radiative power tracking, historical comparison.
"""

from dagster.sources.base_adapter import BaseAdapter, GeoJSONFeature
import os
import httpx
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

FIRMS_API_KEY = os.getenv("FIRMS_API_KEY", "DEMO_KEY")
FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"


class FIRMSAdapter(BaseAdapter):
    source_name = "firms"
    entity_type = "HazardEvent"

    def get_ttl(self) -> int:
        return 86400  # 24 hours

    def _health_url(self) -> str:
        return "https://firms.modaps.eosdis.nasa.gov"

    def fetch(self, source: str = "VIIRS_SNPP_NRT", days: int = 1,
              bbox: tuple[float, float, float, float] | None = None, **kwargs) -> list[dict]:
        """Fetch active fire data from NASA FIRMS."""
        client = self._get_client(timeout=60.0)
        area = "world"
        if bbox:
            area = f"{bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]}"
        url = f"{FIRMS_BASE}/{FIRMS_API_KEY}/{source}/{area}/{days}"
        resp = client.get(url)
        resp.raise_for_status()
        lines = resp.text.strip().split("\n")
        if len(lines) < 2:
            return []
        headers = lines[0].split(",")
        records = []
        for line in lines[1:]:
            values = line.split(",")
            if len(values) == len(headers):
                records.append(dict(zip(headers, values)))
        return records

    def normalize(self, raw_records: list[dict]) -> list[GeoJSONFeature]:
        features = []
        for rec in raw_records:
            try:
                lat = float(rec.get("latitude", 0))
                lng = float(rec.get("longitude", 0))
            except (ValueError, TypeError):
                continue
            confidence = rec.get("confidence", "")
            conf_score = self._parse_confidence(confidence)
            frp = None
            try:
                frp = float(rec.get("frp", 0))
            except (ValueError, TypeError):
                pass
            brightness = None
            try:
                brightness = float(rec.get("bright_ti4", rec.get("brightness", 0)))
            except (ValueError, TypeError):
                pass
            severity = "LOW"
            if frp and frp > 100:
                severity = "CRITICAL"
            elif frp and frp > 50:
                severity = "HIGH"
            elif frp and frp > 10:
                severity = "MODERATE"

            acq_date = rec.get("acq_date", "")
            acq_time = rec.get("acq_time", "0000")

            features.append(GeoJSONFeature(
                geometry={"type": "Point", "coordinates": [lng, lat]},
                properties={
                    "entityType": "HazardEvent",
                    "hazardType": "WILDFIRE",
                    "severity": severity,
                    "alertLevel": "RED" if severity == "CRITICAL" else "ORANGE" if severity == "HIGH" else "YELLOW",
                    "confidence": conf_score,
                    "frp": frp,
                    "brightness": brightness,
                    "satellite": rec.get("satellite", ""),
                    "instrument": rec.get("instrument", ""),
                    "dayNight": rec.get("daynight", ""),
                    "acqDate": acq_date,
                    "acqTime": acq_time,
                    "source": "firms",
                    "timestamp": f"{acq_date}T{acq_time[:2]}:{acq_time[2:]}:00Z" if acq_date else "",
                },
            ))
        return features

    @staticmethod
    def _parse_confidence(conf: str) -> float:
        conf = conf.strip().lower()
        if conf in ("h", "high"):
            return 0.9
        elif conf in ("n", "nominal"):
            return 0.6
        elif conf in ("l", "low"):
            return 0.3
        try:
            return float(conf) / 100.0
        except (ValueError, TypeError):
            return 0.5
