"""
Source Registry — Central registry of all data source adapters.
Each adapter implements BaseAdapter for unified fetch/normalize/cache lifecycle.
"""

from .base_adapter import BaseAdapter
from .opensky_adapter import OpenSkyAdapter
from .ais_adapter import AISAdapter, MultiSourceAISAdapter
from .aisstream_adapter import AISStreamAdapter
from .gfw_adapter import GlobalFishingWatchAdapter
from .firms_adapter import FIRMSAdapter
from .celestrak_adapter import CelesTrakAdapter
from .eq_adapter import EarthquakeAdapter
from .weather_adapter import WeatherAlertAdapter
from .finance_adapter import FinanceAdapter
from .demographic_adapter import DemographicAdapter
from .infrastructure_adapter import InfrastructureDataAdapter

SOURCE_REGISTRY: dict[str, type[BaseAdapter]] = {
    "opensky": OpenSkyAdapter,
    "ais": MultiSourceAISAdapter,
    "aishub": AISAdapter,
    "aisstream": AISStreamAdapter,
    "gfw": GlobalFishingWatchAdapter,
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
    "MultiSourceAISAdapter",
    "AISStreamAdapter",
    "GlobalFishingWatchAdapter",
    "FIRMSAdapter",
    "CelesTrakAdapter",
    "EarthquakeAdapter",
    "WeatherAlertAdapter",
    "FinanceAdapter",
    "DemographicAdapter",
    "InfrastructureDataAdapter",
]
