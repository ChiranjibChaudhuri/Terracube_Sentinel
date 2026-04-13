"""
aisstream.io WebSocket AIS adapter.

Dagster assets are synchronous, so this adapter takes a short WebSocket
snapshot and returns the latest position observed for each MMSI.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from threading import Thread
from typing import Any
from urllib.parse import urlencode

import websockets
from websockets.exceptions import WebSocketException

from .ais_adapter import AISAdapter, classify_ship_type
from .base_adapter import BaseAdapter, GeoJSONFeature

logger = logging.getLogger(__name__)

AISSTREAM_WS_URL = "wss://stream.aisstream.io/v0/stream"
DEFAULT_BOUNDING_BOX = (-90.0, -180.0, 90.0, 180.0)

NAV_STATUS_MAP = {
    0: "UNDER_WAY_USING_ENGINE",
    1: "AT_ANCHOR",
    2: "NOT_UNDER_COMMAND",
    3: "RESTRICTED_MANEUVERABILITY",
    4: "CONSTRAINED_BY_DRAUGHT",
    5: "MOORED",
    6: "AGROUND",
    7: "ENGAGED_IN_FISHING",
    8: "UNDER_WAY_SAILING",
    9: "RESERVED",
    10: "RESERVED",
    11: "POWER_DRIVEN_RESERVED",
    12: "POWER_DRIVEN_RESERVED",
    13: "RESERVED",
    14: "AIS_SART_ACTIVE",
    15: "NOT_DEFINED",
}


class AISStreamAdapter(BaseAdapter):
    source_name = "aisstream"
    entity_type = "Vessel"

    def __init__(
        self,
        api_key: str | None = None,
        snapshot_seconds: float | None = None,
        use_synthetic_fallback: bool = True,
    ):
        super().__init__()
        self.api_key = api_key if api_key is not None else os.getenv("AISSTREAM_API_KEY", "")
        self.ws_url = os.getenv("AISSTREAM_WS_URL", AISSTREAM_WS_URL)
        self.snapshot_seconds = (
            float(snapshot_seconds)
            if snapshot_seconds is not None
            else float(os.getenv("AISSTREAM_SNAPSHOT_SECONDS", "30"))
        )
        self.max_messages = int(os.getenv("AISSTREAM_MAX_MESSAGES", "5000"))
        self.use_synthetic_fallback = use_synthetic_fallback

    def get_ttl(self) -> int:
        return 120

    def _health_url(self) -> str:
        return "https://aisstream.io"

    def fetch(
        self,
        bbox: tuple[float, float, float, float] | None = None,
        bounding_boxes: list[Any] | None = None,
        snapshot_seconds: float | None = None,
        **kwargs,
    ) -> list[dict]:
        """Collect a bounded WebSocket snapshot.

        bbox follows the project convention: (south, west, north, east).
        """
        if not self.api_key:
            if self.use_synthetic_fallback:
                logger.info("AISSTREAM_API_KEY not set — returning synthetic vessel data")
                return self._synthetic_data()
            logger.info("AISSTREAM_API_KEY not set — skipping aisstream source")
            return []

        seconds = (
            float(snapshot_seconds)
            if snapshot_seconds is not None
            else float(kwargs.get("duration_seconds", self.snapshot_seconds))
        )
        boxes = bounding_boxes or self._bounding_boxes_from_bbox(bbox)
        return self._run_snapshot(self.api_key, boxes, max(seconds, 0.1))

    def normalize(self, raw_records: list[dict]) -> list[GeoJSONFeature]:
        features = []
        for rec in raw_records:
            lat = _as_float(_first(rec, "latitude", "LATITUDE", "lat"))
            lng = _as_float(_first(rec, "longitude", "LONGITUDE", "lon", "lng"))
            if lat is None or lng is None:
                continue

            ship_type = rec.get("shipType")
            if not ship_type:
                ship_type = classify_ship_type(_as_int(_first(rec, "shipTypeCode", "SHIPTYPE", "ship_type")))
            ship_type = _normalize_ship_type(ship_type)

            heading = _as_float(_first(rec, "heading", "HEADING"))
            if heading == 511:
                heading = None

            features.append(GeoJSONFeature(
                geometry={"type": "Point", "coordinates": [lng, lat]},
                properties={
                    "entityType": "Vessel",
                    "mmsi": str(_first(rec, "mmsi", "MMSI") or ""),
                    "name": _clean_string(_first(rec, "name", "NAME")),
                    "imo": _clean_string(_first(rec, "imo", "IMO")),
                    "shipType": ship_type,
                    "speed": _as_float(_first(rec, "speed", "SPEED")),
                    "course": _as_float(_first(rec, "course", "COURSE")),
                    "heading": heading,
                    "destination": _clean_string(_first(rec, "destination", "DESTINATION")),
                    "flag": _clean_string(_first(rec, "flag", "FLAG")),
                    "navStatus": _clean_string(_first(rec, "navStatus", "NAV_STATUS")),
                    "isFishing": ship_type == "FISHING",
                    "source": "aisstream",
                    "timestamp": _first(rec, "timestamp", "TIMESTAMP") or _utc_now(),
                },
            ))
        return features

    def graceful_degradation(self, error: Exception) -> list[GeoJSONFeature]:
        logger.warning("aisstream snapshot failed: %s — returning synthetic vessel data", error)
        return self.normalize(self._synthetic_data()) if self.use_synthetic_fallback else []

    def _synthetic_data(self) -> list[dict]:
        synthetic = AISAdapter(use_synthetic_fallback=True)._synthetic_data()
        for record in synthetic:
            record["source"] = "aisstream"
        return synthetic

    def _run_snapshot(self, api_key: str, bounding_boxes: list[Any], seconds: float) -> list[dict]:
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(self._collect_snapshot(api_key, bounding_boxes, seconds))

        result: list[dict] = []
        error: Exception | None = None

        def runner():
            nonlocal result, error
            try:
                result = asyncio.run(self._collect_snapshot(api_key, bounding_boxes, seconds))
            except Exception as exc:  # pragma: no cover - defensive event-loop fallback
                error = exc

        thread = Thread(target=runner, daemon=True)
        thread.start()
        thread.join()
        if error is not None:
            raise error
        return result

    async def _collect_snapshot(self, api_key: str, bounding_boxes: list[Any], seconds: float) -> list[dict]:
        records_by_mmsi: dict[str, dict] = {}
        uri = self._connection_uri(api_key)
        subscribe = {"APIKey": api_key, "BoundingBoxes": bounding_boxes}
        deadline = time.monotonic() + seconds
        received = 0

        try:
            async with websockets.connect(uri, open_timeout=10, close_timeout=2, ping_interval=20) as websocket:
                await websocket.send(json.dumps(subscribe))
                while time.monotonic() < deadline and received < self.max_messages:
                    timeout = max(0.05, min(1.0, deadline - time.monotonic()))
                    try:
                        raw = await asyncio.wait_for(websocket.recv(), timeout=timeout)
                    except asyncio.TimeoutError:
                        continue

                    received += 1
                    try:
                        payload = json.loads(raw)
                    except (TypeError, json.JSONDecodeError):
                        logger.debug("Skipping non-JSON aisstream payload")
                        continue

                    self._merge_message(records_by_mmsi, payload)
        except WebSocketException:
            raise
        except OSError:
            raise

        return list(records_by_mmsi.values())

    def _connection_uri(self, api_key: str) -> str:
        separator = "&" if "?" in self.ws_url else "?"
        return f"{self.ws_url}{separator}{urlencode({'apiKey': api_key})}"

    def _bounding_boxes_from_bbox(self, bbox: tuple[float, float, float, float] | None) -> list[Any]:
        raw_bbox = bbox or _parse_bbox(os.getenv("AISSTREAM_BBOX")) or DEFAULT_BOUNDING_BOX
        south, west, north, east = [float(value) for value in raw_bbox]
        if os.getenv("AISSTREAM_BBOX_FORMAT", "corners").lower() == "flat":
            return [[south, west, north, east]]
        return [[[south, west], [north, east]]]

    def _merge_message(self, records_by_mmsi: dict[str, dict], payload: dict) -> None:
        message_type = payload.get("MessageType") or payload.get("messageType") or payload.get("type")
        message = _as_dict(payload.get("Message") or payload.get("message"))
        metadata = _as_dict(payload.get("MetaData") or payload.get("Metadata") or payload.get("metadata"))

        body = self._message_body(message, message_type)
        mmsi = _clean_string(
            _coalesce(
                _first(metadata, "MMSI_String", "mmsi_string", "MMSI", "mmsi"),
                _first(body, "UserID", "UserId", "MMSI", "mmsi"),
                _first(payload, "MMSI", "mmsi"),
            )
        )
        if not mmsi:
            return

        record = records_by_mmsi.setdefault(mmsi, {"mmsi": mmsi})
        name = _clean_string(_first(metadata, "ShipName", "shipName", "name"))
        if name:
            record["name"] = name

        if self._is_position_report(message_type, body):
            self._merge_position(record, body, metadata)
        elif self._is_static_data(message_type, body):
            self._merge_static(record, body, metadata)
        else:
            logger.debug("Skipping unsupported aisstream message type: %s", message_type)

    @staticmethod
    def _message_body(message: dict, message_type: Any) -> dict:
        for key in ("PositionReport", "ShipStaticData"):
            nested = _as_dict(message.get(key))
            if nested:
                return nested
        if isinstance(message_type, str):
            nested = _as_dict(message.get(message_type))
            if nested:
                return nested
        return message

    @staticmethod
    def _is_position_report(message_type: Any, body: dict) -> bool:
        if str(message_type) in {"1", "2", "3"}:
            return True
        return str(message_type).lower() == "positionreport" or "Sog" in body or "Latitude" in body

    @staticmethod
    def _is_static_data(message_type: Any, body: dict) -> bool:
        if str(message_type) == "5":
            return True
        return str(message_type).lower() == "shipstaticdata" or "ImoNumber" in body or "Destination" in body

    @staticmethod
    def _merge_position(record: dict, body: dict, metadata: dict) -> None:
        lat = _as_float(_coalesce(_first(body, "Latitude", "latitude"), _first(metadata, "Latitude", "latitude")))
        lng = _as_float(_coalesce(_first(body, "Longitude", "longitude"), _first(metadata, "Longitude", "longitude")))
        if lat is not None:
            record["latitude"] = lat
        if lng is not None:
            record["longitude"] = lng

        speed = _as_float(_first(body, "Sog", "SpeedOverGround", "speed"))
        if speed is not None:
            record["speed"] = speed
        course = _as_float(_first(body, "Cog", "CourseOverGround", "course"))
        if course is not None:
            record["course"] = course
        heading = _as_float(_first(body, "TrueHeading", "Heading", "heading"))
        if heading is not None and heading != 511:
            record["heading"] = heading

        nav_status = _as_int(_first(body, "NavigationalStatus", "NavigationStatus", "navStatus"))
        if nav_status is not None:
            record["navStatus"] = NAV_STATUS_MAP.get(nav_status, f"UNKNOWN_{nav_status}")

        timestamp = _first(metadata, "time_utc", "timeUtc", "timestamp") or _first(body, "Timestamp", "timestamp")
        record["timestamp"] = _format_timestamp(timestamp)

    @staticmethod
    def _merge_static(record: dict, body: dict, metadata: dict) -> None:
        name = _clean_string(_coalesce(_first(body, "Name", "ShipName", "name"), _first(metadata, "ShipName", "shipName")))
        if name:
            record["name"] = name
        imo = _clean_string(_first(body, "ImoNumber", "IMONumber", "IMO", "imo"))
        if imo and imo != "0":
            record["imo"] = imo
        ship_type_code = _as_int(_first(body, "Type", "ShipType", "shipType"))
        if ship_type_code is not None:
            record["shipTypeCode"] = ship_type_code
            record["shipType"] = classify_ship_type(ship_type_code)
        destination = _clean_string(_first(body, "Destination", "destination"))
        if destination:
            record["destination"] = destination

        timestamp = _first(metadata, "time_utc", "timeUtc", "timestamp")
        if timestamp:
            record["timestamp"] = _format_timestamp(timestamp)


def _parse_bbox(raw: str | None) -> tuple[float, float, float, float] | None:
    if not raw:
        return None
    parts = [part.strip() for part in raw.split(",")]
    if len(parts) != 4:
        logger.warning("Invalid AISSTREAM_BBOX value %r; expected south,west,north,east", raw)
        return None
    try:
        return tuple(float(part) for part in parts)  # type: ignore[return-value]
    except ValueError:
        logger.warning("Invalid AISSTREAM_BBOX value %r; expected numeric coordinates", raw)
        return None


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _first(mapping: dict, *keys: str) -> Any:
    for key in keys:
        value = mapping.get(key)
        if value not in (None, ""):
            return value
    return None


def _coalesce(*values: Any) -> Any:
    for value in values:
        if value not in (None, ""):
            return value
    return None


def _as_float(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed == parsed else None


def _as_int(value: Any) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _clean_string(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", str(value).strip())
    return cleaned or None


def _normalize_ship_type(value: Any) -> str:
    normalized = str(value or "OTHER").upper().replace("-", "_").replace(" ", "_")
    if normalized in {"CARGO", "TANKER", "PASSENGER", "FISHING", "MILITARY", "PLEASURE", "TUG", "OTHER"}:
        return normalized
    if "FISH" in normalized:
        return "FISHING"
    if "TANK" in normalized:
        return "TANKER"
    if "PASSENGER" in normalized:
        return "PASSENGER"
    if any(part in normalized for part in ("CARGO", "CONTAINER", "CARRIER", "REEFER")):
        return "CARGO"
    return "OTHER"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _format_timestamp(value: Any) -> str:
    if value in (None, ""):
        return _utc_now()
    if isinstance(value, (int, float)):
        if value > 1_000_000_000:
            return datetime.fromtimestamp(value, tz=timezone.utc).isoformat().replace("+00:00", "Z")
        return _utc_now()
    text = str(value).strip()
    if not text:
        return _utc_now()
    if text.endswith("Z"):
        return text
    if re.match(r"^\d{4}-\d{2}-\d{2}T", text):
        return text
    return text
