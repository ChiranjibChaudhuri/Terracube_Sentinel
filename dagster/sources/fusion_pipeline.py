"""
Dagster pipeline that runs all source adapters on their schedules
and loads normalized data into the ontology via Foundry API.
"""

import os
import logging
from dataclasses import dataclass, asdict
from datetime import datetime

import httpx
from dagster import (
    asset,
    job,
    schedule,
    AssetExecutionContext,
    DefaultScheduleStatus,
)

from dagster.sources.base_adapter import GeoJSONFeature
from dagster.sources.cache import FusionCache
from dagster.sources.opensky_adapter import OpenSkyAdapter
from dagster.sources.ais_adapter import AISAdapter
from dagster.sources.firms_adapter import FIRMSAdapter
from dagster.sources.celestrak_adapter import CelesTrakAdapter
from dagster.sources.eq_adapter import EarthquakeAdapter
from dagster.sources.weather_adapter import WeatherAlertAdapter
from dagster.sources.finance_adapter import FinanceAdapter
from dagster.sources.demographic_adapter import DemographicAdapter
from dagster.sources.infrastructure_adapter import InfrastructureDataAdapter

logger = logging.getLogger(__name__)

FOUNDRY_API_URL = os.getenv("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_TOKEN = os.getenv("FOUNDRY_TOKEN", "")

cache = FusionCache()


def _load_to_foundry(features: list[GeoJSONFeature], context: AssetExecutionContext | None = None):
    """Load normalized GeoJSON features to Foundry API."""
    headers = {"Authorization": f"Bearer {FOUNDRY_TOKEN}", "Content-Type": "application/json"}
    loaded = 0
    with httpx.Client(timeout=30, base_url=FOUNDRY_API_URL) as client:
        for feat in features:
            entity_type = feat.properties.get("entityType", "Unknown")
            entity_id = _make_id(feat)
            # Cache first
            cache.set(entity_type, entity_id, feat.to_dict())
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
            except Exception as e:
                logger.debug("Foundry load failed for %s: %s", entity_id, e)
    if context:
        context.log.info(f"Loaded {loaded}/{len(features)} features to Foundry")
    return loaded


def _make_id(feat: GeoJSONFeature) -> str:
    """Generate a stable ID from feature properties."""
    props = feat.properties
    et = props.get("entityType", "")
    if et == "Aircraft":
        return f"aircraft-{props.get('icao24', '')}"
    elif et == "Vessel":
        return f"vessel-{props.get('mmsi', '')}"
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
def fetch_aircraft_positions(context: AssetExecutionContext) -> list[dict]:
    """Fetch real-time aircraft positions from OpenSky Network."""
    adapter = OpenSkyAdapter()
    features = adapter.fetch_and_normalize()
    context.log.info(f"Fetched {len(features)} aircraft positions")
    _load_to_foundry(features, context)
    return [f.to_dict() for f in features]


@asset(group_name="data_fusion")
def fetch_vessel_positions(context: AssetExecutionContext) -> list[dict]:
    """Fetch real-time vessel positions from AIS feeds."""
    adapter = AISAdapter()
    features = adapter.fetch_and_normalize()
    context.log.info(f"Fetched {len(features)} vessel positions")
    _load_to_foundry(features, context)
    return [f.to_dict() for f in features]


@asset(group_name="data_fusion")
def fetch_enhanced_fires(context: AssetExecutionContext) -> list[dict]:
    """Fetch enhanced fire data with FRP and confidence scoring."""
    adapter = FIRMSAdapter()
    features = adapter.fetch_and_normalize(source="VIIRS_SNPP_NRT", days=1)
    context.log.info(f"Fetched {len(features)} fire detections")
    _load_to_foundry(features, context)
    return [f.to_dict() for f in features]


@asset(group_name="data_fusion")
def fetch_satellite_positions(context: AssetExecutionContext) -> list[dict]:
    """Fetch satellite orbital positions from CelesTrak."""
    adapter = CelesTrakAdapter()
    features = adapter.fetch_and_normalize(group="weather")
    context.log.info(f"Fetched {len(features)} satellite positions")
    _load_to_foundry(features, context)
    return [f.to_dict() for f in features]


@asset(group_name="data_fusion")
def fetch_enhanced_earthquakes(context: AssetExecutionContext) -> list[dict]:
    """Fetch earthquakes with ShakeMap, tsunami alerts, aftershock tracking."""
    adapter = EarthquakeAdapter()
    features = adapter.fetch_and_normalize(min_magnitude="2.5")
    context.log.info(f"Fetched {len(features)} earthquakes")
    _load_to_foundry(features, context)
    return [f.to_dict() for f in features]


@asset(group_name="data_fusion")
def fetch_weather_alerts(context: AssetExecutionContext) -> list[dict]:
    """Fetch NWS weather alerts and tropical cyclone data."""
    adapter = WeatherAlertAdapter()
    features = adapter.fetch_and_normalize()
    context.log.info(f"Fetched {len(features)} weather alerts")
    _load_to_foundry(features, context)
    return [f.to_dict() for f in features]


@asset(group_name="data_fusion")
def fetch_financial_indicators(context: AssetExecutionContext) -> list[dict]:
    """Fetch financial market data: indices, commodities, crypto."""
    adapter = FinanceAdapter()
    features = adapter.fetch_and_normalize()
    context.log.info(f"Fetched {len(features)} financial indicators")
    _load_to_foundry(features, context)
    return [f.to_dict() for f in features]


@asset(group_name="data_fusion")
def fetch_demographic_data(context: AssetExecutionContext) -> list[dict]:
    """Fetch socio-economic indicators from World Bank."""
    adapter = DemographicAdapter()
    features = adapter.fetch_and_normalize()
    context.log.info(f"Fetched {len(features)} demographic indicators")
    _load_to_foundry(features, context)
    return [f.to_dict() for f in features]


@asset(group_name="data_fusion")
def fetch_infrastructure_data(context: AssetExecutionContext) -> list[dict]:
    """Fetch airports and ports data."""
    adapter = InfrastructureDataAdapter()
    airports = adapter.fetch_and_normalize(data_type="airports")
    ports = adapter.fetch_and_normalize(data_type="ports")
    all_features = airports + ports
    context.log.info(f"Fetched {len(airports)} airports + {len(ports)} ports")
    _load_to_foundry(all_features, context)
    return [f.to_dict() for f in all_features]


# ── Job ────────────────────────────────────────────────────────────

@job
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


# ── Schedule ───────────────────────────────────────────────────────

@schedule(
    job=data_fusion_job,
    cron_schedule="*/5 * * * *",
    default_status=DefaultScheduleStatus.STOPPED,
)
def data_fusion_schedule(_context):
    """Run data fusion pipeline every 5 minutes."""
    return {}
