"""
Source Registry — Central registry of all data source adapters.
Each adapter implements BaseAdapter for unified fetch/normalize/cache lifecycle.
"""

from dagster.sources.base_adapter import BaseAdapter
from dagster.sources.opensky_adapter import OpenSkyAdapter
from dagster.sources.ais_adapter import AISAdapter
from dagster.sources.firms_adapter import FIRMSAdapter
from dagster.sources.celestrak_adapter import CelesTrakAdapter
from dagster.sources.eq_adapter import EarthquakeAdapter
from dagster.sources.weather_adapter import WeatherAlertAdapter
from dagster.sources.finance_adapter import FinanceAdapter
from dagster.sources.demographic_adapter import DemographicAdapter
from dagster.sources.infrastructure_adapter import InfrastructureDataAdapter

SOURCE_REGISTRY: dict[str, type[BaseAdapter]] = {
    "opensky": OpenSkyAdapter,
    "ais": AISAdapter,
    "firms": FIRMSAdapter,
    "celestrak": CelesTrakAdapter,
    "earthquake": EarthquakeAdapter,
    "weather_alerts": WeatherAlertAdapter,
    "finance": FinanceAdapter,
    "demographic": DemographicAdapter,
    "infrastructure": InfrastructureDataAdapter,
}

__all__ = [
    "BaseAdapter",
    "SOURCE_REGISTRY",
    "OpenSkyAdapter",
    "AISAdapter",
    "FIRMSAdapter",
    "CelesTrakAdapter",
    "EarthquakeAdapter",
    "WeatherAlertAdapter",
    "FinanceAdapter",
    "DemographicAdapter",
    "InfrastructureDataAdapter",
]
