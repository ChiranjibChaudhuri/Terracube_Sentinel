"""
AIS vessel tracking adapter.
Fetches vessel positions from public AIS data feeds.
"""

from dataclasses import dataclass
from dagster.sources.base_adapter import BaseAdapter, GeoJSONFeature
import os
import httpx
import logging

logger = logging.getLogger(__name__)

# Public AIS data endpoint (configurable)
AIS_API_URL = os.getenv("AIS_API_URL", "https://data.aishub.net/ws.php")
AIS_API_KEY = os.getenv("AIS_API_KEY", "")


@dataclass
class VesselRecord:
    mmsi: str
    name: str | None
    imo: str | None
    ship_type: int | None
    longitude: float
    latitude: float
    speed: float | None
    course: float | None
    destination: str | None
    timestamp: str


SHIP_TYPE_MAP = {
    range(20, 30): "CARGO",
    range(60, 70): "PASSENGER",
    range(70, 80): "CARGO",
    range(80, 90): "TANKER",
    range(30, 36): "FISHING",
    range(35, 37): "MILITARY",
}


def classify_ship_type(type_code: int | None) -> str:
    if type_code is None:
        return "OTHER"
    for rng, label in SHIP_TYPE_MAP.items():
        if type_code in rng:
            return label
    return "OTHER"


class AISAdapter(BaseAdapter):
    source_name = "ais"
    entity_type = "Vessel"

    def get_ttl(self) -> int:
        return 900

    def fetch(self, bbox: tuple[float, float, float, float] | None = None, **kwargs) -> list[dict]:
        """Fetch vessel positions. Degrades gracefully if no API key."""
        if not AIS_API_KEY:
            logger.info("AIS_API_KEY not set — returning synthetic vessel data")
            return self._synthetic_data()
        client = self._get_client(timeout=30.0)
        params = {"username": AIS_API_KEY, "format": "1", "output": "json", "compress": "0"}
        if bbox:
            params.update({
                "latmin": bbox[0], "lonmin": bbox[1],
                "latmax": bbox[2], "lonmax": bbox[3],
            })
        resp = client.get(AIS_API_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else data.get("data", [])

    def _synthetic_data(self) -> list[dict]:
        """Synthetic vessel data for development/demo."""
        import time
        ts = int(time.time())
        return [
            {"MMSI": "211331640", "NAME": "ATLANTIC GUARDIAN", "IMO": "9434765", "SHIPTYPE": 70,
             "LONGITUDE": -5.3, "LATITUDE": 36.1, "SPEED": 12.4, "COURSE": 270, "DESTINATION": "ROTTERDAM", "TIMESTAMP": ts},
            {"MMSI": "244630590", "NAME": "PACIFIC TRADER", "IMO": "9567123", "SHIPTYPE": 80,
             "LONGITUDE": 103.8, "LATITUDE": 1.3, "SPEED": 8.2, "COURSE": 45, "DESTINATION": "SINGAPORE", "TIMESTAMP": ts},
            {"MMSI": "366998310", "NAME": "COASTAL RUNNER", "IMO": "9012345", "SHIPTYPE": 60,
             "LONGITUDE": -74.0, "LATITUDE": 40.7, "SPEED": 15.1, "COURSE": 180, "DESTINATION": "MIAMI", "TIMESTAMP": ts},
            {"MMSI": "538005890", "NAME": "NORTHERN STAR", "IMO": "9876543", "SHIPTYPE": 31,
             "LONGITUDE": 5.3, "LATITUDE": 60.4, "SPEED": 5.0, "COURSE": 90, "DESTINATION": "BERGEN", "TIMESTAMP": ts},
        ]

    def normalize(self, raw_records: list[dict]) -> list[GeoJSONFeature]:
        features = []
        for rec in raw_records:
            lng = rec.get("LONGITUDE") or rec.get("longitude")
            lat = rec.get("LATITUDE") or rec.get("latitude")
            if lng is None or lat is None:
                continue
            features.append(GeoJSONFeature(
                geometry={"type": "Point", "coordinates": [float(lng), float(lat)]},
                properties={
                    "entityType": "Vessel",
                    "mmsi": str(rec.get("MMSI", rec.get("mmsi", ""))),
                    "name": rec.get("NAME", rec.get("name")),
                    "imo": rec.get("IMO", rec.get("imo")),
                    "shipType": classify_ship_type(rec.get("SHIPTYPE", rec.get("ship_type"))),
                    "speed": rec.get("SPEED", rec.get("speed")),
                    "course": rec.get("COURSE", rec.get("course")),
                    "destination": rec.get("DESTINATION", rec.get("destination")),
                    "source": "ais",
                    "timestamp": rec.get("TIMESTAMP", rec.get("timestamp")),
                },
            ))
        return features
