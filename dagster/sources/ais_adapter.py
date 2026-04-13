"""
AIS vessel tracking adapter.
Fetches vessel positions from public AIS data feeds.
"""

import os
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from .base_adapter import BaseAdapter, GeoJSONFeature

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


def classify_ship_type(type_code: int | str | None) -> str:
    if type_code is None:
        return "OTHER"
    try:
        type_code = int(type_code)
    except (TypeError, ValueError):
        return "OTHER"
    for rng, label in SHIP_TYPE_MAP.items():
        if type_code in rng:
            return label
    return "OTHER"


class AISAdapter(BaseAdapter):
    source_name = "ais"
    entity_type = "Vessel"

    def __init__(self, use_synthetic_fallback: bool = True):
        super().__init__()
        self.use_synthetic_fallback = use_synthetic_fallback

    def get_ttl(self) -> int:
        return 900

    def fetch(self, bbox: tuple[float, float, float, float] | None = None, **kwargs) -> list[dict]:
        """Fetch vessel positions. Degrades gracefully if no API key."""
        if not AIS_API_KEY:
            if self.use_synthetic_fallback:
                logger.info("AIS_API_KEY not set — returning synthetic vessel data")
                return self._synthetic_data()
            logger.info("AIS_API_KEY not set — skipping AISHub source")
            return []
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
            lng = _as_float(_first(rec, "LONGITUDE", "longitude", "lon", "lng"))
            lat = _as_float(_first(rec, "LATITUDE", "latitude", "lat"))
            if lng is None or lat is None:
                logger.debug("Skipping AIS record without valid coordinates: %s", rec)
                continue
            features.append(GeoJSONFeature(
                geometry={"type": "Point", "coordinates": [lng, lat]},
                properties={
                    "entityType": "Vessel",
                    "mmsi": str(_first(rec, "MMSI", "mmsi") or ""),
                    "name": _first(rec, "NAME", "name"),
                    "imo": _first(rec, "IMO", "imo"),
                    "shipType": classify_ship_type(_first(rec, "SHIPTYPE", "ship_type", "shipType")),
                    "speed": _as_float(_first(rec, "SPEED", "speed")),
                    "course": _as_float(_first(rec, "COURSE", "course")),
                    "heading": _as_float(_first(rec, "HEADING", "heading")),
                    "destination": _first(rec, "DESTINATION", "destination"),
                    "flag": _first(rec, "FLAG", "flag"),
                    "navStatus": _first(rec, "NAVSTATUS", "NAV_STATUS", "navStatus"),
                    "isFishing": classify_ship_type(_first(rec, "SHIPTYPE", "ship_type", "shipType")) == "FISHING",
                    "source": _first(rec, "source", "SOURCE") or "ais",
                    "timestamp": _first(rec, "TIMESTAMP", "timestamp"),
                },
            ))
        return features


class MultiSourceAISAdapter(BaseAdapter):
    """Unified AIS adapter that merges AISHub, aisstream.io, and GFW results."""

    source_name = "ais_multi"
    entity_type = "Vessel"

    def __init__(
        self,
        sources: list[str] | None = None,
        use_synthetic_fallback: bool = True,
    ):
        super().__init__()
        configured = sources or _configured_sources()
        self.sources = [source.strip().lower() for source in configured if source.strip()]
        self.use_synthetic_fallback = use_synthetic_fallback

    def get_ttl(self) -> int:
        return 120

    def fetch(self, **kwargs) -> list[dict]:
        return [feature.to_dict() for feature in self.fetch_and_normalize(**kwargs)]

    def normalize(self, raw_records: list[dict]) -> list[GeoJSONFeature]:
        features = []
        for record in raw_records:
            if isinstance(record, GeoJSONFeature):
                features.append(record)
                continue
            if record.get("type") == "Feature":
                features.append(GeoJSONFeature(
                    geometry=record.get("geometry") or {},
                    properties=record.get("properties") or {},
                ))
        return features

    def fetch_and_normalize(self, **kwargs) -> list[GeoJSONFeature]:
        features: list[GeoJSONFeature] = []
        source_fetchers = {
            "ais": self.fetch_aishub,
            "aishub": self.fetch_aishub,
            "aisstream": self.fetch_aisstream,
            "gfw": self.fetch_gfw,
        }

        for source_name in self.sources:
            fetcher = source_fetchers.get(source_name)
            if fetcher is None:
                logger.warning("Unknown AIS source %s — skipping", source_name)
                continue
            try:
                source_features = fetcher(**kwargs)
                logger.info("Fetched %d AIS features from %s", len(source_features), source_name)
                features.extend(source_features)
            except Exception as exc:
                logger.warning("%s AIS source failed: %s", source_name, exc)

        deduped = self._dedupe_by_mmsi(features)
        if deduped:
            return deduped

        if self.use_synthetic_fallback:
            logger.info("No configured AIS source returned data — using synthetic vessel data")
            adapter = AISAdapter(use_synthetic_fallback=True)
            try:
                return adapter.normalize(adapter._synthetic_data())
            finally:
                adapter.close()
        return []

    def fetch_aishub(self, **kwargs) -> list[GeoJSONFeature]:
        adapter = AISAdapter(use_synthetic_fallback=False)
        try:
            return adapter.fetch_and_normalize(**kwargs)
        finally:
            adapter.close()

    def fetch_aisstream(self, **kwargs) -> list[GeoJSONFeature]:
        from .aisstream_adapter import AISStreamAdapter

        adapter = AISStreamAdapter(use_synthetic_fallback=False)
        try:
            return adapter.fetch_and_normalize(**kwargs)
        finally:
            adapter.close()

    def fetch_gfw(self, **kwargs) -> list[GeoJSONFeature]:
        from .gfw_adapter import GlobalFishingWatchAdapter

        adapter = GlobalFishingWatchAdapter()
        try:
            return adapter.fetch_and_normalize(**kwargs)
        finally:
            adapter.close()

    @staticmethod
    def _dedupe_by_mmsi(features: list[GeoJSONFeature]) -> list[GeoJSONFeature]:
        deduped: dict[str, GeoJSONFeature] = {}
        for feature in features:
            props = feature.properties
            mmsi = str(props.get("mmsi") or "").strip()
            if not mmsi:
                coordinates = feature.geometry.get("coordinates", [])
                key = f"{props.get('source', 'unknown')}:{coordinates}:{props.get('timestamp', '')}"
            else:
                key = mmsi

            existing = deduped.get(key)
            if existing is None:
                deduped[key] = feature
                continue

            if _timestamp_sort_value(feature.properties.get("timestamp")) >= _timestamp_sort_value(existing.properties.get("timestamp")):
                _fill_missing_properties(feature.properties, existing.properties)
                deduped[key] = feature
            else:
                _fill_missing_properties(existing.properties, feature.properties)

        return list(deduped.values())


def _configured_sources() -> list[str]:
    raw = os.getenv("AIS_SOURCES", "aishub,aisstream,gfw")
    return [part.strip() for part in raw.split(",") if part.strip()]


def _first(mapping: dict, *keys: str) -> Any:
    for key in keys:
        value = mapping.get(key)
        if value not in (None, ""):
            return value
    return None


def _as_float(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed == parsed else None


def _fill_missing_properties(target: dict, fallback: dict) -> None:
    for key, value in fallback.items():
        if key in {"source", "timestamp"}:
            continue
        if target.get(key) in (None, "") and value not in (None, ""):
            target[key] = value


def _timestamp_sort_value(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return 0.0
    try:
        return float(text)
    except ValueError:
        pass
    if text.endswith("Z"):
        text = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text).timestamp()
    except ValueError:
        return 0.0
