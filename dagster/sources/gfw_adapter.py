"""
Global Fishing Watch 4Wings AIS vessel presence adapter.

Uses the public-global-presence:latest dataset, which provides one AIS
position per vessel per hour up to the current 96 hour data latency.
"""

from __future__ import annotations

import logging
import math
import os
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from itertools import combinations
from typing import Any, Iterable

from .base_adapter import BaseAdapter, GeoJSONFeature

logger = logging.getLogger(__name__)

GFW_REPORT_URL = "https://gateway.api.globalfishingwatch.org/v3/4wings/report"
GFW_PRESENCE_DATASET = "public-global-presence:latest"
DEFAULT_VESSEL_TYPES = ("fishing", "tanker", "cargo", "passenger", "other")
ENCOUNTER_DISTANCE_METERS = 500.0
ENCOUNTER_SPEED_KNOTS = 0.5
ENCOUNTER_DURATION_HOURS = 2.0
EARTH_RADIUS_METERS = 6_371_000.0


class GlobalFishingWatchAdapter(BaseAdapter):
    source_name = "gfw"
    entity_type = "Vessel"

    def __init__(
        self,
        api_token: str | None = None,
        api_url: str | None = None,
        dataset: str | None = None,
    ):
        super().__init__()
        self.api_token = api_token if api_token is not None else os.getenv("GFW_API_TOKEN", "")
        self.api_url = api_url or os.getenv("GFW_API_URL", GFW_REPORT_URL)
        self.dataset = dataset or os.getenv("GFW_DATASET", GFW_PRESENCE_DATASET)
        self.default_bbox = _parse_bbox(os.getenv("GFW_BBOX"))
        self.default_limit = int(os.getenv("GFW_MAX_RECORDS", "1000"))
        self.lookback_hours = int(os.getenv("GFW_LOOKBACK_HOURS", "24"))

    def get_ttl(self) -> int:
        return 3600

    def _health_url(self) -> str:
        return self.api_url

    def fetch(
        self,
        bbox: tuple[float, float, float, float] | None = None,
        vessel_types: Iterable[str] | None = None,
        flags: Iterable[str] | None = None,
        date_range: str | tuple[str, str] | None = None,
        region_id: str | int | None = None,
        region_dataset: str | None = None,
        limit: int | None = None,
        **kwargs,
    ) -> list[dict]:
        """Fetch hourly AIS vessel presence records from 4Wings.

        bbox follows the project convention: (south, west, north, east).
        """
        if not self.api_token:
            logger.info("GFW_API_TOKEN not set — skipping Global Fishing Watch source")
            return []

        client = self._get_client(timeout=100.0)
        params = self._build_params(
            vessel_types=vessel_types,
            flags=flags,
            date_range=date_range,
            limit=limit,
            spatial_resolution=str(kwargs.get("spatial_resolution", "HIGH")),
            temporal_resolution=str(kwargs.get("temporal_resolution", "HOURLY")),
            group_by=str(kwargs.get("group_by", "VESSEL_ID")),
        )
        result_limit = int(params.pop("_limit"))
        headers = {"Authorization": f"Bearer {self.api_token}", "Content-Type": "application/json"}

        active_bbox = bbox or self.default_bbox
        if active_bbox:
            response = client.post(
                self.api_url,
                params=params,
                headers=headers,
                json={"geojson": _bbox_to_geojson(active_bbox)},
            )
        else:
            if region_id is not None:
                params["region-id"] = str(region_id)
                params["region-dataset"] = region_dataset or "public-eez-areas"
            response = client.get(self.api_url, params=params, headers=headers)

        response.raise_for_status()
        return self._extract_records(response.json())[:result_limit]

    def normalize(self, raw_records: list[dict]) -> list[GeoJSONFeature]:
        annotated_records = self._annotate_encounters(raw_records)
        features = []
        for rec in annotated_records:
            lat = _as_float(_first(rec, "lat", "latitude", "LATITUDE"))
            lng = _as_float(_first(rec, "lon", "longitude", "LONGITUDE", "lng"))
            if lat is None or lng is None:
                continue

            vessel_id = _clean_string(_first(rec, "vesselId", "vessel_id", "id"))
            mmsi = _clean_string(_first(rec, "mmsi", "MMSI", "ssvid", "SSVID")) or vessel_id or ""
            raw_ship_type = _clean_string(_first(rec, "shipType", "vessel_type", "shiptype", "type"))
            ship_type = _normalize_ship_type(raw_ship_type)
            timestamp = _format_timestamp(_first(rec, "timestamp", "date", "entryTimestamp"))

            properties = {
                "entityType": "Vessel",
                "vesselId": vessel_id,
                "mmsi": mmsi,
                "name": _clean_string(_first(rec, "name", "shipName", "shipname", "vesselName")),
                "shipType": ship_type,
                "flag": _clean_string(_first(rec, "flag", "flagState", "flag_state")),
                "speed": _parse_speed(_first(rec, "speed", "speedKnots", "sog")),
                "course": _as_float(_first(rec, "course", "cog")),
                "heading": _as_float(_first(rec, "heading", "trueHeading")),
                "navStatus": _clean_string(_first(rec, "navStatus", "nav_status")),
                "source": "gfw",
                "timestamp": timestamp,
                "isFishing": _is_fishing(raw_ship_type, rec),
                "encounterDetected": bool(rec.get("encounterDetected")),
                "encounterWith": sorted(rec.get("encounterWith", [])),
                "encounterDurationHours": rec.get("encounterDurationHours"),
            }

            features.append(GeoJSONFeature(
                geometry={"type": "Point", "coordinates": [lng, lat]},
                properties=properties,
            ))
        return features

    def _build_params(
        self,
        vessel_types: Iterable[str] | None,
        flags: Iterable[str] | None,
        date_range: str | tuple[str, str] | None,
        limit: int | None,
        spatial_resolution: str,
        temporal_resolution: str,
        group_by: str,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "spatial-resolution": spatial_resolution.upper(),
            "temporal-resolution": temporal_resolution.upper(),
            "spatial-aggregation": "false",
            "group-by": group_by.upper(),
            "datasets[0]": self.dataset,
            "date-range": _format_date_range(date_range, self.lookback_hours),
            "format": "JSON",
        }
        filters = self._build_filter(vessel_types, flags)
        if filters:
            params["filters[0]"] = filters

        params["_limit"] = int(limit or self.default_limit)
        params["limit"] = params["_limit"]
        return params

    @staticmethod
    def _build_filter(vessel_types: Iterable[str] | None, flags: Iterable[str] | None) -> str:
        expressions = []
        types = [v.strip().lower() for v in (vessel_types or DEFAULT_VESSEL_TYPES) if v and v.strip()]
        if types:
            quoted = ",".join(f'"{v}"' for v in types)
            expressions.append(f"vessel_type in ({quoted})")

        flag_values = [f.strip().upper() for f in (flags or []) if f and f.strip()]
        if flag_values:
            quoted = ",".join(f"'{flag}'" for flag in flag_values)
            expressions.append(f"flag in ({quoted})")

        return " and ".join(expressions)

    @staticmethod
    def _extract_records(payload: dict) -> list[dict]:
        records = list(_iter_gfw_records(payload.get("entries", payload)))
        for record in records:
            if "timestamp" not in record and "date" in record:
                record["timestamp"] = _format_timestamp(record.get("date"))
        return records

    def _annotate_encounters(self, raw_records: list[dict]) -> list[dict]:
        records = [dict(record) for record in raw_records]
        by_vessel: dict[str, list[dict]] = defaultdict(list)

        for record in records:
            vessel_key = _vessel_key(record)
            lat = _as_float(_first(record, "lat", "latitude", "LATITUDE"))
            lng = _as_float(_first(record, "lon", "longitude", "LONGITUDE", "lng"))
            speed = _parse_speed(_first(record, "speed", "speedKnots", "sog"))
            timestamp = _parse_timestamp(_first(record, "timestamp", "date", "entryTimestamp"))
            if not vessel_key or lat is None or lng is None or speed is None or timestamp is None:
                continue
            if speed >= ENCOUNTER_SPEED_KNOTS:
                continue
            record["_encounterPoint"] = (lat, lng, timestamp)
            by_vessel[vessel_key].append(record)

        if len(by_vessel) < 2:
            return records

        annotations: dict[str, dict[str, float]] = defaultdict(dict)
        for vessel_a, vessel_b in combinations(sorted(by_vessel), 2):
            matches = self._encounter_matches(by_vessel[vessel_a], by_vessel[vessel_b])
            duration_hours = _longest_consecutive_duration(matches)
            if duration_hours >= ENCOUNTER_DURATION_HOURS:
                annotations[vessel_a][vessel_b] = duration_hours
                annotations[vessel_b][vessel_a] = duration_hours

        if not annotations:
            return records

        for record in records:
            vessel_key = _vessel_key(record)
            if not vessel_key or vessel_key not in annotations:
                continue
            record["encounterDetected"] = True
            record["encounterWith"] = set(annotations[vessel_key])
            record["encounterDurationHours"] = max(annotations[vessel_key].values())

        return records

    @staticmethod
    def _encounter_matches(records_a: list[dict], records_b: list[dict]) -> list[datetime]:
        matches: list[datetime] = []
        for rec_a in records_a:
            lat_a, lng_a, ts_a = rec_a["_encounterPoint"]
            for rec_b in records_b:
                lat_b, lng_b, ts_b = rec_b["_encounterPoint"]
                if abs((ts_a - ts_b).total_seconds()) > 3600:
                    continue
                if _distance_meters(lat_a, lng_a, lat_b, lng_b) <= ENCOUNTER_DISTANCE_METERS:
                    matches.append(max(ts_a, ts_b))
        return matches


def _iter_gfw_records(value: Any) -> Iterable[dict]:
    if isinstance(value, list):
        for item in value:
            yield from _iter_gfw_records(item)
        return
    if not isinstance(value, dict):
        return

    if _looks_like_record(value):
        yield dict(value)
        return

    for key, nested in value.items():
        if isinstance(nested, list) and ("public-" in str(key) or str(key).startswith("dataset")):
            for item in nested:
                if isinstance(item, dict):
                    item = dict(item)
                    item.setdefault("dataset", key)
                    yield item
        else:
            yield from _iter_gfw_records(nested)


def _looks_like_record(value: dict) -> bool:
    keys = set(value)
    return bool(keys & {"lat", "latitude", "lon", "longitude"}) and bool(
        keys & {"date", "timestamp", "vessel_id", "vesselId", "id", "mmsi", "ssvid"}
    )


def _bbox_to_geojson(bbox: tuple[float, float, float, float]) -> dict:
    south, west, north, east = [float(value) for value in bbox]
    return {
        "type": "Polygon",
        "coordinates": [[
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
        ]],
    }


def _parse_bbox(raw: str | None) -> tuple[float, float, float, float] | None:
    if not raw:
        return None
    parts = [part.strip() for part in raw.split(",")]
    if len(parts) != 4:
        logger.warning("Invalid GFW_BBOX value %r; expected south,west,north,east", raw)
        return None
    try:
        return tuple(float(part) for part in parts)  # type: ignore[return-value]
    except ValueError:
        logger.warning("Invalid GFW_BBOX value %r; expected numeric coordinates", raw)
        return None


def _format_date_range(date_range: str | tuple[str, str] | None, lookback_hours: int) -> str:
    if isinstance(date_range, str):
        return date_range
    if isinstance(date_range, tuple):
        return f"{date_range[0]},{date_range[1]}"

    end = datetime.now(timezone.utc) - timedelta(hours=96)
    start = end - timedelta(hours=max(lookback_hours, 1))
    return f"{_gfw_datetime(start)},{_gfw_datetime(end)}"


def _gfw_datetime(value: datetime) -> str:
    value = value.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return value.isoformat(timespec="milliseconds").replace("+00:00", "Z")


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


def _parse_speed(value: Any) -> float | None:
    numeric = _as_float(value)
    if numeric is not None:
        return numeric
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.startswith("<"):
        return _as_float(text[1:])
    if text.startswith(">"):
        return _as_float(text[1:])
    match = re.match(r"^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$", text)
    if match:
        return (float(match.group(1)) + float(match.group(2))) / 2
    return None


def _clean_string(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", str(value).strip())
    return cleaned or None


def _normalize_ship_type(value: str | None) -> str:
    if not value:
        return "OTHER"
    normalized = value.upper().replace("-", "_").replace(" ", "_")
    if normalized in {"CARGO", "TANKER", "PASSENGER", "FISHING", "MILITARY", "PLEASURE", "TUG"}:
        return normalized
    if normalized in {"CARRIER", "REEFER", "BULK_CARRIER", "CONTAINER"}:
        return "CARGO"
    if "FISH" in normalized:
        return "FISHING"
    if "TANK" in normalized:
        return "TANKER"
    if "PASSENGER" in normalized:
        return "PASSENGER"
    return "OTHER"


def _is_fishing(raw_ship_type: str | None, record: dict) -> bool:
    if raw_ship_type and "fish" in raw_ship_type.lower():
        return True
    return bool(_first(record, "geartype", "gearType", "fishingHours", "fishing_hours"))


def _format_timestamp(value: Any) -> str:
    parsed = _parse_timestamp(value)
    if parsed is None:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return parsed.isoformat().replace("+00:00", "Z")


def _parse_timestamp(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    text = str(value).strip()
    if not text:
        return None
    if "," in text:
        text = text.split(",")[-1].strip()
    if re.match(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$", text):
        text = text.replace(" ", "T") + ":00Z"
    elif re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        text = f"{text}T00:00:00Z"
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def _vessel_key(record: dict) -> str | None:
    return _clean_string(_first(record, "mmsi", "MMSI", "ssvid", "SSVID", "vesselId", "vessel_id", "id"))


def _distance_meters(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
    phi_a = math.radians(lat_a)
    phi_b = math.radians(lat_b)
    delta_phi = math.radians(lat_b - lat_a)
    delta_lambda = math.radians(lng_b - lng_a)
    hav = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi_a) * math.cos(phi_b) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_METERS * math.atan2(math.sqrt(hav), math.sqrt(1 - hav))


def _longest_consecutive_duration(timestamps: list[datetime]) -> float:
    if len(timestamps) < 2:
        return 0.0

    ordered = sorted(set(timestamps))
    best = 0.0
    start = ordered[0]
    previous = ordered[0]
    for current in ordered[1:]:
        if (current - previous).total_seconds() > 5400:
            best = max(best, (previous - start).total_seconds() / 3600)
            start = current
        previous = current
    best = max(best, (previous - start).total_seconds() / 3600)
    return best
