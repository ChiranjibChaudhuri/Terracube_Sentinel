"""
OpenSky Network adapter — ADS-B flight tracking.
Fetches aircraft state vectors: lat, lng, altitude, heading, velocity, callsign, icao24.
"""

from dataclasses import dataclass
from .base_adapter import BaseAdapter, GeoJSONFeature
import httpx
import logging

logger = logging.getLogger(__name__)

OPENSKY_API = "https://opensky-network.org/api"


@dataclass
class AircraftRecord:
    icao24: str
    callsign: str | None
    longitude: float
    latitude: float
    altitude: float | None
    heading: float | None
    velocity: float | None
    on_ground: bool
    timestamp: int


class OpenSkyAdapter(BaseAdapter):
    source_name = "opensky"
    entity_type = "Aircraft"

    def get_ttl(self) -> int:
        return 120

    def _health_url(self) -> str:
        return f"{OPENSKY_API}/states/all?lamin=0&lamax=1&lomin=0&lomax=1"

    def fetch(self, bbox: tuple[float, float, float, float] | None = None, **kwargs) -> list[dict]:
        """Fetch aircraft states. bbox=(lamin, lomin, lamax, lomax)"""
        client = self._get_client(timeout=30.0)
        params = {}
        if bbox:
            params.update({
                "lamin": bbox[0], "lomin": bbox[1],
                "lamax": bbox[2], "lomax": bbox[3],
            })
        resp = client.get(f"{OPENSKY_API}/states/all", params=params)
        resp.raise_for_status()
        data = resp.json()
        return data.get("states", []) or []

    def normalize(self, raw_records: list) -> list[GeoJSONFeature]:
        features = []
        for state in raw_records:
            if len(state) < 17:
                continue
            lng, lat = state[5], state[6]
            if lng is None or lat is None:
                continue
            features.append(GeoJSONFeature(
                geometry={"type": "Point", "coordinates": [lng, lat]},
                properties={
                    "entityType": "Aircraft",
                    "icao24": state[0],
                    "callsign": (state[1] or "").strip(),
                    "altitude": state[7] or state[13],
                    "heading": state[10],
                    "velocity": state[9],
                    "onGround": state[8],
                    "source": "opensky",
                    "timestamp": state[3] or state[4],
                },
            ))
        return features
