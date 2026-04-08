"""Real-time hazard ingestion pipeline.

Sources: Open-Meteo (weather), USGS (earthquakes), NASA FIRMS (fires), NASA EONET (events).
Schedule: every 5 minutes.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any

import httpx
from dagster import asset, define_asset_job, AssetSelection, get_dagster_logger

FOUNDRY_API_URL = os.environ.get("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_API_TOKEN = os.environ.get("FOUNDRY_API_TOKEN", "")

# ── Common schema ──────────────────────────────────────────────────────


@dataclass
class HazardRecord:
    """Normalised hazard record that maps to the HazardEvent object type."""

    source: str
    hazard_type: str  # HazardType enum value
    severity: str  # SeverityLevel enum value
    alert_level: str  # AlertLevel enum value
    geometry: dict  # GeoJSON geometry
    start_time: str  # ISO-8601
    end_time: str | None = None
    confidence: float | None = None
    raw: dict = field(default_factory=dict)


# ── Helpers ────────────────────────────────────────────────────────────


def _severity_from_magnitude(mag: float) -> str:
    if mag >= 7.0:
        return "CRITICAL"
    if mag >= 5.0:
        return "HIGH"
    if mag >= 3.0:
        return "MODERATE"
    return "LOW"


def _alert_from_severity(severity: str) -> str:
    return {
        "CRITICAL": "RED",
        "HIGH": "ORANGE",
        "MODERATE": "YELLOW",
        "LOW": "GREEN",
    }.get(severity, "GREEN")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Assets ─────────────────────────────────────────────────────────────


@asset(group_name="real_time_hazards", compute_kind="api")
def fetch_open_meteo_weather() -> list[dict[str, Any]]:
    """Fetch severe weather alerts from Open-Meteo API."""
    log = get_dagster_logger()
    # Open-Meteo forecast endpoint — fetch for a global grid of sample points
    sample_coords = [
        (35.68, 139.69),  # Tokyo
        (28.61, 77.21),   # Delhi
        (37.77, -122.42), # San Francisco
        (-33.87, 151.21), # Sydney
        (51.51, -0.13),   # London
    ]

    records: list[dict[str, Any]] = []
    with httpx.Client(timeout=30) as client:
        for lat, lon in sample_coords:
            try:
                resp = client.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "current": "temperature_2m,wind_speed_10m,weather_code",
                        "timezone": "UTC",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                current = data.get("current", {})
                weather_code = current.get("weather_code", 0)

                # Only emit a record for severe weather codes (≥ 65)
                if weather_code >= 65:
                    wind = current.get("wind_speed_10m", 0)
                    severity = "CRITICAL" if wind > 100 else "HIGH" if wind > 60 else "MODERATE"
                    records.append(
                        asdict(
                            HazardRecord(
                                source="open-meteo",
                                hazard_type="STORM",
                                severity=severity,
                                alert_level=_alert_from_severity(severity),
                                geometry={"type": "Point", "coordinates": [lon, lat]},
                                start_time=current.get("time", _now_iso()),
                                confidence=0.8,
                                raw=current,
                            )
                        )
                    )
            except httpx.HTTPError as exc:
                log.warning(f"Open-Meteo fetch failed for ({lat},{lon}): {exc}")

    log.info(f"Open-Meteo: {len(records)} severe weather records")
    return records


@asset(group_name="real_time_hazards", compute_kind="api")
def fetch_usgs_earthquakes() -> list[dict[str, Any]]:
    """Fetch recent earthquakes from USGS GeoJSON feed."""
    log = get_dagster_logger()
    url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"
    records: list[dict[str, Any]] = []

    with httpx.Client(timeout=30) as client:
        try:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()

            for feature in data.get("features", []):
                props = feature.get("properties", {})
                mag = props.get("mag", 0) or 0
                severity = _severity_from_magnitude(mag)
                ts = props.get("time")
                start_time = (
                    datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat()
                    if ts
                    else _now_iso()
                )

                records.append(
                    asdict(
                        HazardRecord(
                            source="usgs",
                            hazard_type="EARTHQUAKE",
                            severity=severity,
                            alert_level=_alert_from_severity(severity),
                            geometry=feature.get("geometry", {}),
                            start_time=start_time,
                            confidence=1.0,
                            raw=props,
                        )
                    )
                )
        except httpx.HTTPError as exc:
            log.warning(f"USGS fetch failed: {exc}")

    log.info(f"USGS: {len(records)} earthquake records")
    return records


@asset(group_name="real_time_hazards", compute_kind="api")
def fetch_nasa_firms_fires() -> list[dict[str, Any]]:
    """Fetch active fire data from NASA FIRMS (CSV endpoint)."""
    log = get_dagster_logger()
    map_key = os.environ.get("NASA_FIRMS_MAP_KEY", "")
    url = (
        f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/VIIRS_SNPP_NRT/world/1"
        if map_key
        else "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv"
    )
    records: list[dict[str, Any]] = []

    with httpx.Client(timeout=60) as client:
        try:
            resp = client.get(url)
            resp.raise_for_status()
            lines = resp.text.strip().split("\n")
            if len(lines) < 2:
                return records

            headers = lines[0].split(",")
            lat_idx = headers.index("latitude") if "latitude" in headers else None
            lon_idx = headers.index("longitude") if "longitude" in headers else None
            conf_idx = headers.index("confidence") if "confidence" in headers else None
            frp_idx = headers.index("frp") if "frp" in headers else None
            date_idx = headers.index("acq_date") if "acq_date" in headers else None
            time_idx = headers.index("acq_time") if "acq_time" in headers else None

            if lat_idx is None or lon_idx is None:
                log.warning("FIRMS CSV missing lat/lon columns")
                return records

            for line in lines[1:]:
                cols = line.split(",")
                try:
                    lat = float(cols[lat_idx])
                    lon = float(cols[lon_idx])
                    frp = float(cols[frp_idx]) if frp_idx is not None else 0
                    conf_raw = cols[conf_idx].strip().lower() if conf_idx is not None else "n"

                    severity = "CRITICAL" if frp > 100 else "HIGH" if frp > 50 else "MODERATE" if frp > 10 else "LOW"
                    confidence_map = {"h": 0.9, "high": 0.9, "n": 0.5, "nominal": 0.5, "l": 0.2, "low": 0.2}
                    confidence = confidence_map.get(conf_raw, 0.5)

                    acq_date = cols[date_idx] if date_idx is not None else ""
                    acq_time = cols[time_idx] if time_idx is not None else "0000"
                    start_time = f"{acq_date}T{acq_time[:2]}:{acq_time[2:]}:00Z" if acq_date else _now_iso()

                    records.append(
                        asdict(
                            HazardRecord(
                                source="nasa-firms",
                                hazard_type="WILDFIRE",
                                severity=severity,
                                alert_level=_alert_from_severity(severity),
                                geometry={"type": "Point", "coordinates": [lon, lat]},
                                start_time=start_time,
                                confidence=confidence,
                                raw={"frp": frp},
                            )
                        )
                    )
                except (ValueError, IndexError):
                    continue

        except httpx.HTTPError as exc:
            log.warning(f"NASA FIRMS fetch failed: {exc}")

    log.info(f"NASA FIRMS: {len(records)} fire records")
    return records


@asset(group_name="real_time_hazards", compute_kind="api")
def fetch_nasa_eonet_events() -> list[dict[str, Any]]:
    """Fetch recent natural events from NASA EONET v3."""
    log = get_dagster_logger()
    url = "https://eonet.gsfc.nasa.gov/api/v3/events"
    records: list[dict[str, Any]] = []

    category_to_hazard = {
        "earthquakes": "EARTHQUAKE",
        "volcanoes": "VOLCANIC",
        "wildfires": "WILDFIRE",
        "severeStorms": "STORM",
        "floods": "FLOOD",
        "landslides": "LANDSLIDE",
        "drought": "DROUGHT",
    }

    with httpx.Client(timeout=30) as client:
        try:
            resp = client.get(url, params={"status": "open", "limit": 50})
            resp.raise_for_status()
            data = resp.json()

            for event in data.get("events", []):
                categories = event.get("categories", [])
                cat_id = categories[0]["id"] if categories else "unknown"
                hazard_type = category_to_hazard.get(cat_id, "STORM")

                geometries = event.get("geometry", [])
                if not geometries:
                    continue
                latest_geom = geometries[-1]
                coords = latest_geom.get("coordinates", [])
                geom_date = latest_geom.get("date", _now_iso())

                geojson = {"type": "Point", "coordinates": coords} if len(coords) == 2 else {"type": "Point", "coordinates": [0, 0]}

                records.append(
                    asdict(
                        HazardRecord(
                            source="nasa-eonet",
                            hazard_type=hazard_type,
                            severity="MODERATE",
                            alert_level="YELLOW",
                            geometry=geojson,
                            start_time=geom_date,
                            confidence=0.7,
                            raw={"title": event.get("title", ""), "id": event.get("id", "")},
                        )
                    )
                )
        except httpx.HTTPError as exc:
            log.warning(f"NASA EONET fetch failed: {exc}")

    log.info(f"NASA EONET: {len(records)} event records")
    return records


@asset(
    group_name="real_time_hazards",
    compute_kind="transform",
    deps=[
        fetch_open_meteo_weather,
        fetch_usgs_earthquakes,
        fetch_nasa_firms_fires,
        fetch_nasa_eonet_events,
    ],
)
def normalize_hazard_records(
    fetch_open_meteo_weather: list[dict[str, Any]],
    fetch_usgs_earthquakes: list[dict[str, Any]],
    fetch_nasa_firms_fires: list[dict[str, Any]],
    fetch_nasa_eonet_events: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Merge and deduplicate hazard records from all sources."""
    log = get_dagster_logger()
    all_records = (
        fetch_open_meteo_weather
        + fetch_usgs_earthquakes
        + fetch_nasa_firms_fires
        + fetch_nasa_eonet_events
    )

    # Simple dedup by (source, hazard_type, geometry coordinates, start_time)
    seen: set[tuple[str, str, str, str]] = set()
    deduped: list[dict[str, Any]] = []
    for rec in all_records:
        coords = str(rec.get("geometry", {}).get("coordinates", []))
        key = (rec["source"], rec["hazard_type"], coords, rec["start_time"])
        if key not in seen:
            seen.add(key)
            deduped.append(rec)

    log.info(f"Normalized {len(all_records)} → {len(deduped)} records after dedup")
    return deduped


@asset(group_name="real_time_hazards", compute_kind="api", deps=[normalize_hazard_records])
def load_hazards_to_foundry(normalize_hazard_records: list[dict[str, Any]]) -> dict[str, int]:
    """Load normalised hazard records into Open Foundry via REST API."""
    log = get_dagster_logger()
    headers = {"Authorization": f"Bearer {FOUNDRY_API_TOKEN}", "Content-Type": "application/json"}
    created = 0
    failed = 0

    with httpx.Client(timeout=30, base_url=FOUNDRY_API_URL) as client:
        for rec in normalize_hazard_records:
            payload = {
                "objectType": "HazardEvent",
                "properties": {
                    "type": rec["hazard_type"],
                    "severity": rec["severity"],
                    "alertLevel": rec["alert_level"],
                    "geometry": rec["geometry"],
                    "startTime": rec["start_time"],
                    "endTime": rec.get("end_time"),
                    "confidence": rec.get("confidence"),
                },
            }
            try:
                resp = client.post("/objects", json=payload, headers=headers)
                resp.raise_for_status()
                created += 1
            except httpx.HTTPError as exc:
                log.warning(f"Failed to load hazard record: {exc}")
                failed += 1

    log.info(f"Loaded {created} hazard events, {failed} failures")
    return {"created": created, "failed": failed}


# ── Job ────────────────────────────────────────────────────────────────

real_time_hazards_job = define_asset_job(
    name="real_time_hazards_job",
    selection=AssetSelection.groups("real_time_hazards"),
    description="Ingest hazard data from Open-Meteo, USGS, NASA FIRMS, and NASA EONET",
)
