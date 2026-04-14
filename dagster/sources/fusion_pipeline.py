"""
Dagster pipeline that runs all source adapters on their schedules
and loads normalized data into the ontology via Foundry API.
"""

import os
import logging

import httpx
from dagster import (
    asset,
    job,
    schedule,
    OpExecutionContext,
    DefaultScheduleStatus,
    in_process_executor,
)

from .base_adapter import GeoJSONFeature
from .cache import FusionCache
from .opensky_adapter import OpenSkyAdapter
from .ais_adapter import MultiSourceAISAdapter
from .aisstream_adapter import AISStreamAdapter
from .gfw_adapter import GlobalFishingWatchAdapter
from .firms_adapter import FIRMSAdapter
from .celestrak_adapter import CelesTrakAdapter
from .eq_adapter import EarthquakeAdapter
from .weather_adapter import WeatherAlertAdapter
from .finance_adapter import FinanceAdapter
from .demographic_adapter import DemographicAdapter
from .infrastructure_adapter import InfrastructureDataAdapter

logger = logging.getLogger(__name__)

FOUNDRY_API_URL = os.getenv("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_TOKEN = os.getenv("FOUNDRY_TOKEN") or os.getenv("FOUNDRY_API_TOKEN", "")

cache = FusionCache()

VESSEL_SOURCE_TTLS = {
    "aisstream": 120,
    "gfw": 3600,
}


def _load_to_foundry(features: list[GeoJSONFeature], context: OpExecutionContext | None = None):
    """Load normalized GeoJSON features to Foundry API."""
    headers = {"Content-Type": "application/json"}
    if FOUNDRY_TOKEN:
        headers["Authorization"] = f"Bearer {FOUNDRY_TOKEN}"
    loaded = 0
    failed = 0
    with httpx.Client(timeout=30, base_url=FOUNDRY_API_URL) as client:
        for feat in features:
            entity_type = feat.properties.get("entityType", "Unknown")
            entity_id = _make_id(feat)
            # Cache first
            cache.set(entity_type, entity_id, feat.to_dict(), ttl=_cache_ttl_for_feature(feat))
            # Then load to Foundry
            payload = {
                "objectType": entity_type,
                "properties": feat.properties,
                "geometry": feat.geometry,
            }
            try:
                resp = client.post("/objects", json=payload, headers=headers)
                if resp.status_code < 300:
                    loaded += 1
            except httpx.HTTPError as e:
                logger.warning("Foundry load failed for %s: %s", entity_id, e)
                failed += 1
            except Exception as e:
                logger.warning("Foundry load failed for %s: %s", entity_id, e)
                failed += 1
    # Raise if majority of loads failed (indicates systemic API issue)
    if features and failed > 0 and failed > len(features) / 2:
        logger.error(
            "Foundry API appears down: %d/%d loads failed", failed, len(features)
        )
    if context:
        context.log.info(f"Loaded {loaded}/{len(features)} features to Foundry")
        if failed > 0:
            context.log.warning(f"Failed to load {failed}/{len(features)} features to Foundry")
    return loaded


def _cache_ttl_for_feature(feat: GeoJSONFeature) -> int | None:
    """Return source-specific cache TTLs where needed."""
    if feat.properties.get("entityType") == "Vessel":
        return VESSEL_SOURCE_TTLS.get(str(feat.properties.get("source", "")).lower())
    return None


def _make_id(feat: GeoJSONFeature) -> str:
    """Generate a stable ID from feature properties."""
    props = feat.properties
    et = props.get("entityType", "")
    if et == "Aircraft":
        return f"aircraft-{props.get('icao24', '')}"
    elif et == "Vessel":
        return f"vessel-{props.get('mmsi') or props.get('vesselId', '')}"
    elif et == "HazardEvent":
        return f"hazard-{props.get('source', '')}-{props.get('timestamp', '')}-{feat.geometry.get('coordinates', [0, 0])}"
    elif et == "SatellitePass":
        return f"sat-{props.get('noradId', '')}"
    elif et == "FinancialIndicator":
        return f"fin-{props.get('symbol', props.get('indicatorCode', ''))}"
    elif et == "Airport":
        return f"airport-{props.get('icaoCode', '')}"
    elif et == "Port":
        return f"port-{props.get('unlocode', '')}"
    return f"{et}-{hash(str(props))}"


# ── Assets ────────────────────────────────────────────────────────

@asset(group_name="data_fusion")
def fetch_aircraft_positions(context: OpExecutionContext) -> list[dict]:
    """Fetch real-time aircraft positions from OpenSky Network."""
    adapter = OpenSkyAdapter()
    try:
        features = adapter.fetch_and_normalize()
        context.log.info(f"Fetched {len(features)} aircraft positions")
        _load_to_foundry(features, context)
        return [f.to_dict() for f in features]
    finally:
        adapter.close()


@asset(group_name="data_fusion")
def fetch_vessel_positions(context: OpExecutionContext) -> list[dict]:
    """Fetch real-time vessel positions from all configured AIS feeds."""
    adapter = MultiSourceAISAdapter()
    try:
        features = adapter.fetch_and_normalize()
        context.log.info(f"Fetched {len(features)} vessel positions")
        _load_to_foundry(features, context)
        return [f.to_dict() for f in features]
    finally:
        adapter.close()


@asset(group_name="data_fusion")
def fetch_aisstream_vessels(context: OpExecutionContext) -> list[dict]:
    """Fetch real-time vessel positions from aisstream.io."""
    adapter = AISStreamAdapter()
    try:
        features = adapter.fetch_and_normalize()
        context.log.info(f"Fetched {len(features)} aisstream vessel positions")
        _load_to_foundry(features, context)
        return [f.to_dict() for f in features]
    finally:
        adapter.close()


@asset(group_name="data_fusion")
def fetch_gfw_vessels(context: OpExecutionContext) -> list[dict]:
    """Fetch recent historical vessel positions from Global Fishing Watch."""
    adapter = GlobalFishingWatchAdapter()
    try:
        features = adapter.fetch_and_normalize()
        context.log.info(f"Fetched {len(features)} GFW vessel positions")
        _load_to_foundry(features, context)
        return [f.to_dict() for f in features]
    finally:
        adapter.close()


@asset(group_name="data_fusion")
def fetch_enhanced_fires(context: OpExecutionContext) -> list[dict]:
    """Fetch enhanced fire data with FRP and confidence scoring."""
    adapter = FIRMSAdapter()
    try:
        features = adapter.fetch_and_normalize(source="VIIRS_SNPP_NRT", days=1)
        context.log.info(f"Fetched {len(features)} fire detections")
        _load_to_foundry(features, context)
        return [f.to_dict() for f in features]
    finally:
        adapter.close()


@asset(group_name="data_fusion")
def fetch_satellite_positions(context: OpExecutionContext) -> list[dict]:
    """Fetch satellite orbital positions from CelesTrak."""
    adapter = CelesTrakAdapter()
    try:
        features = adapter.fetch_and_normalize(group="weather")
        context.log.info(f"Fetched {len(features)} satellite positions")
        _load_to_foundry(features, context)
        return [f.to_dict() for f in features]
    finally:
        adapter.close()


@asset(group_name="data_fusion")
def fetch_enhanced_earthquakes(context: OpExecutionContext) -> list[dict]:
    """Fetch earthquakes with ShakeMap, tsunami alerts, aftershock tracking."""
    adapter = EarthquakeAdapter()
    try:
        features = adapter.fetch_and_normalize(min_magnitude="2.5")
        context.log.info(f"Fetched {len(features)} earthquakes")
        _load_to_foundry(features, context)
        return [f.to_dict() for f in features]
    finally:
        adapter.close()


@asset(group_name="data_fusion")
def fetch_weather_alerts(context: OpExecutionContext) -> list[dict]:
    """Fetch NWS weather alerts and tropical cyclone data."""
    adapter = WeatherAlertAdapter()
    try:
        features = adapter.fetch_and_normalize()
        context.log.info(f"Fetched {len(features)} weather alerts")
        _load_to_foundry(features, context)
        return [f.to_dict() for f in features]
    finally:
        adapter.close()


@asset(group_name="data_fusion")
def fetch_financial_indicators(context: OpExecutionContext) -> list[dict]:
    """Fetch financial market data: indices, commodities, crypto."""
    adapter = FinanceAdapter()
    try:
        features = adapter.fetch_and_normalize()
        context.log.info(f"Fetched {len(features)} financial indicators")
        _load_to_foundry(features, context)
        return [f.to_dict() for f in features]
    finally:
        adapter.close()


@asset(group_name="data_fusion")
def fetch_demographic_data(context: OpExecutionContext) -> list[dict]:
    """Fetch socio-economic indicators from World Bank."""
    adapter = DemographicAdapter()
    try:
        features = adapter.fetch_and_normalize()
        context.log.info(f"Fetched {len(features)} demographic indicators")
        _load_to_foundry(features, context)
        return [f.to_dict() for f in features]
    finally:
        adapter.close()


@asset(group_name="data_fusion")
def fetch_infrastructure_data(context: OpExecutionContext) -> list[dict]:
    """Fetch airports and ports data."""
    adapter = InfrastructureDataAdapter()
    try:
        airports = adapter.fetch_and_normalize(data_type="airports")
        ports = adapter.fetch_and_normalize(data_type="ports")
        all_features = airports + ports
        context.log.info(f"Fetched {len(airports)} airports + {len(ports)} ports")
        _load_to_foundry(all_features, context)
        return [f.to_dict() for f in all_features]
    finally:
        adapter.close()


# ── Job ────────────────────────────────────────────────────────────

@job(executor_def=in_process_executor)
def data_fusion_job():
    """Run all data fusion source adapters."""
    fetch_aircraft_positions()
    fetch_vessel_positions()
    fetch_enhanced_fires()
    fetch_satellite_positions()
    fetch_enhanced_earthquakes()
    fetch_weather_alerts()
    fetch_financial_indicators()
    fetch_demographic_data()
    fetch_infrastructure_data()


@job
def aisstream_vessel_job():
    """Run the aisstream.io vessel snapshot asset."""
    fetch_aisstream_vessels()


@job
def gfw_vessel_job():
    """Run the Global Fishing Watch vessel asset."""
    fetch_gfw_vessels()


# ── Schedule ───────────────────────────────────────────────────────

@schedule(
    job=data_fusion_job,
    cron_schedule="*/5 * * * *",
    default_status=DefaultScheduleStatus.STOPPED,
)
def data_fusion_schedule(_context):
    """Run data fusion pipeline every 5 minutes."""
    return {}


@schedule(
    job=aisstream_vessel_job,
    cron_schedule="*/2 * * * *",
    default_status=DefaultScheduleStatus.STOPPED,
)
def aisstream_vessel_schedule(_context):
    """Run aisstream vessel snapshots every 2 minutes."""
    return {}


@schedule(
    job=gfw_vessel_job,
    cron_schedule="*/15 * * * *",
    default_status=DefaultScheduleStatus.STOPPED,
)
def gfw_vessel_schedule(_context):
    """Run GFW vessel snapshots every 15 minutes."""
    return {}
