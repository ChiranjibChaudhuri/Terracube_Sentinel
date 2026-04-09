"""Air quality monitoring pipeline.

Sources: OpenAQ (PM2.5, PM10, O3, NO2), WAQI (AQI by city).
Schedule: every 30 minutes.
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
WAQI_API_TOKEN = os.environ.get("WAQI_API_TOKEN", "")

# Major cities to monitor
MONITORED_CITIES = [
    {"city": "Beijing", "country": "CN", "lat": 39.91, "lon": 116.40},
    {"city": "Delhi", "country": "IN", "lat": 28.61, "lon": 77.21},
    {"city": "Los Angeles", "country": "US", "lat": 34.05, "lon": -118.24},
    {"city": "London", "country": "GB", "lat": 51.51, "lon": -0.13},
    {"city": "Tokyo", "country": "JP", "lat": 35.68, "lon": 139.69},
    {"city": "Lagos", "country": "NG", "lat": 6.52, "lon": 3.38},
    {"city": "Sao Paulo", "country": "BR", "lat": -23.55, "lon": -46.63},
    {"city": "Cairo", "country": "EG", "lat": 30.04, "lon": 31.24},
    {"city": "Sydney", "country": "AU", "lat": -33.87, "lon": 151.21},
    {"city": "Mexico City", "country": "MX", "lat": 19.43, "lon": -99.13},
]

# Parameters of interest
AQ_PARAMETERS = ["pm25", "pm10", "o3", "no2"]


# ── Common schema ──────────────────────────────────────────────────────


@dataclass
class AirQualityRecord:
    """Normalised air quality record."""

    source: str
    city: str
    country: str
    parameter: str  # PM25, PM10, O3, NO2
    value: float
    unit: str
    aqi: int | None = None
    geometry: dict = field(default_factory=dict)  # GeoJSON Point
    timestamp: str = ""


# ── Helpers ────────────────────────────────────────────────────────────


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Assets ─────────────────────────────────────────────────────────────


@asset(group_name="air_quality", compute_kind="api")
def fetch_openaq_measurements() -> list[dict[str, Any]]:
    """Fetch latest PM2.5, PM10, O3, NO2 measurements from OpenAQ API v3."""
    log = get_dagster_logger()
    records: list[dict[str, Any]] = []

    with httpx.Client(timeout=30, base_url="https://api.openaq.org/v3") as client:
        for city_info in MONITORED_CITIES:
            try:
                # v3: search locations near coordinates, then fetch latest measurements
                resp = client.get(
                    "/locations",
                    params={
                        "coordinates": f"{city_info['lat']},{city_info['lon']}",
                        "radius": 25000,
                        "limit": 10,
                    },
                    headers={"Accept": "application/json"},
                )
                resp.raise_for_status()
                data = resp.json()

                for location in data.get("results", []):
                    location_id = location.get("id")
                    coords = location.get("coordinates", {})
                    lat = coords.get("latitude", city_info["lat"])
                    lon = coords.get("longitude", city_info["lon"])

                    # Fetch latest measurements for this location
                    try:
                        mresp = client.get(
                            f"/locations/{location_id}/latest",
                            headers={"Accept": "application/json"},
                        )
                        mresp.raise_for_status()
                        mdata = mresp.json()

                        for measurement in mdata.get("results", []):
                            param = measurement.get("parameter", {})
                            param_name = param.get("name", "").lower() if isinstance(param, dict) else str(param).lower()
                            if param_name in AQ_PARAMETERS:
                                records.append({
                                    "source": "openaq",
                                    "city": city_info["city"],
                                    "country": city_info["country"],
                                    "parameter": param_name.upper(),
                                    "value": measurement.get("value", 0),
                                    "unit": measurement.get("unit", ""),
                                    "geometry": {
                                        "type": "Point",
                                        "coordinates": [lon, lat],
                                    },
                                    "timestamp": measurement.get(
                                        "datetime", {}).get("utc", _now_iso()
                                    ) if isinstance(measurement.get("datetime"), dict) else _now_iso(),
                                })
                    except httpx.HTTPError as exc:
                        log.debug(
                            f"OpenAQ measurements fetch failed for location {location_id}: {exc}"
                        )

            except httpx.HTTPError as exc:
                log.warning(
                    f"OpenAQ fetch failed for {city_info['city']}: {exc}"
                )

    log.info(f"OpenAQ: {len(records)} measurement records")
    return records


@asset(group_name="air_quality", compute_kind="api")
def fetch_waqi_status() -> list[dict[str, Any]]:
    """Fetch AQI status by city from World Air Quality Index (WAQI) API."""
    log = get_dagster_logger()
    records: list[dict[str, Any]] = []

    if not WAQI_API_TOKEN:
        log.warning(
            "WAQI_API_TOKEN not set -- returning empty results. "
            "Set the token to enable WAQI integration."
        )
        return records

    with httpx.Client(timeout=30) as client:
        for city_info in MONITORED_CITIES:
            try:
                feed_url = (
                    f"https://api.waqi.info/feed/{city_info['city']}/"
                )
                resp = client.get(
                    feed_url,
                    params={"token": WAQI_API_TOKEN},
                )
                resp.raise_for_status()
                data = resp.json()

                if data.get("status") != "ok":
                    log.warning(
                        f"WAQI returned non-ok status for "
                        f"{city_info['city']}: {data.get('status')}"
                    )
                    continue

                result = data.get("data", {})
                aqi_value = result.get("aqi")
                if aqi_value is None:
                    continue

                city_data = result.get("city", {})
                geo = city_data.get("geo", [])
                lat = geo[0] if len(geo) > 0 else city_info["lat"]
                lon = geo[1] if len(geo) > 1 else city_info["lon"]

                # Extract individual pollutant readings from iaqi
                iaqi = result.get("iaqi", {})
                for param_key in AQ_PARAMETERS:
                    param_data = iaqi.get(param_key, {})
                    if param_data:
                        records.append({
                            "source": "waqi",
                            "city": city_info["city"],
                            "country": city_info["country"],
                            "parameter": param_key.upper(),
                            "value": param_data.get("v", 0),
                            "unit": "AQI-index",
                            "aqi": int(aqi_value) if aqi_value else None,
                            "geometry": {
                                "type": "Point",
                                "coordinates": [float(lon), float(lat)],
                            },
                            "timestamp": result.get("time", {}).get(
                                "iso", _now_iso()
                            ),
                        })

            except httpx.HTTPError as exc:
                log.warning(
                    f"WAQI fetch failed for {city_info['city']}: {exc}"
                )

    log.info(f"WAQI: {len(records)} AQI records")
    return records


@asset(
    group_name="air_quality",
    compute_kind="transform",
    deps=[fetch_openaq_measurements, fetch_waqi_status],
)
def normalize_air_quality(
    fetch_openaq_measurements: list[dict[str, Any]],
    fetch_waqi_status: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Combine OpenAQ and WAQI data into normalised AirQualityRecord dicts."""
    log = get_dagster_logger()
    all_records: list[dict[str, Any]] = []

    for rec in fetch_openaq_measurements:
        all_records.append(
            asdict(
                AirQualityRecord(
                    source=rec.get("source", "openaq"),
                    city=rec.get("city", ""),
                    country=rec.get("country", ""),
                    parameter=rec.get("parameter", ""),
                    value=rec.get("value", 0),
                    unit=rec.get("unit", ""),
                    aqi=None,
                    geometry=rec.get("geometry", {}),
                    timestamp=rec.get("timestamp", _now_iso()),
                )
            )
        )

    for rec in fetch_waqi_status:
        all_records.append(
            asdict(
                AirQualityRecord(
                    source=rec.get("source", "waqi"),
                    city=rec.get("city", ""),
                    country=rec.get("country", ""),
                    parameter=rec.get("parameter", ""),
                    value=rec.get("value", 0),
                    unit=rec.get("unit", ""),
                    aqi=rec.get("aqi"),
                    geometry=rec.get("geometry", {}),
                    timestamp=rec.get("timestamp", _now_iso()),
                )
            )
        )

    # Deduplicate by (source, city, parameter, timestamp)
    seen: set[tuple[str, str, str, str]] = set()
    deduped: list[dict[str, Any]] = []
    for rec in all_records:
        key = (rec["source"], rec["city"], rec["parameter"], rec["timestamp"])
        if key not in seen:
            seen.add(key)
            deduped.append(rec)

    log.info(
        f"Normalized {len(all_records)} -> {len(deduped)} air quality records "
        f"after dedup"
    )
    return deduped


@asset(
    group_name="air_quality",
    compute_kind="api",
    deps=[normalize_air_quality],
)
def load_air_quality_to_foundry(
    normalize_air_quality: list[dict[str, Any]],
) -> dict[str, int]:
    """Load normalised air quality records into Open Foundry via REST API."""
    log = get_dagster_logger()
    headers = {
        "Authorization": f"Bearer {FOUNDRY_API_TOKEN}",
        "Content-Type": "application/json",
    }
    created = 0
    failed = 0

    with httpx.Client(timeout=30, base_url=FOUNDRY_API_URL) as client:
        for rec in normalize_air_quality:
            payload = {
                "objectType": "AirQualityMeasurement",
                "properties": {
                    "source": rec["source"],
                    "city": rec["city"],
                    "country": rec["country"],
                    "parameter": rec["parameter"],
                    "value": rec["value"],
                    "unit": rec["unit"],
                    "aqi": rec.get("aqi"),
                    "geometry": rec["geometry"],
                    "timestamp": rec["timestamp"],
                },
            }
            try:
                resp = client.post("/objects", json=payload, headers=headers)
                resp.raise_for_status()
                created += 1
            except httpx.HTTPError as exc:
                log.warning(f"Failed to load air quality record: {exc}")
                failed += 1

    log.info(f"Loaded {created} air quality records, {failed} failures")
    return {"created": created, "failed": failed}


# ── Job ────────────────────────────────────────────────────────────────

air_quality_job = define_asset_job(
    name="air_quality_job",
    selection=AssetSelection.groups("air_quality"),
    description="Fetch air quality data from OpenAQ and WAQI, normalise, and load to Foundry",
)

# Schedule: every 30 minutes — cron_schedule="*/30 * * * *"
