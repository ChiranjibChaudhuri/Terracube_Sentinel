from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

# Open-Meteo free weather API (no key required)
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


async def get_forecast(
    latitude: float,
    longitude: float,
    days: int = 7,
) -> dict:
    """Retrieve a weather forecast from the Open-Meteo API.

    Args:
        latitude: Latitude of the location.
        longitude: Longitude of the location.
        days: Number of forecast days (1-16).

    Returns:
        A dict with daily and hourly forecast data including
        temperature, precipitation, wind speed, and weather codes.
    """
    params: dict[str, str | float | int] = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": ",".join([
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "wind_speed_10m_max",
            "weather_code",
        ]),
        "hourly": ",".join([
            "temperature_2m",
            "precipitation",
            "wind_speed_10m",
            "weather_code",
        ]),
        "forecast_days": days,
        "timezone": "UTC",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    # Return a cleaned-up structure
    return {
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "timezone": data.get("timezone"),
        "daily": data.get("daily", {}),
        "hourly": data.get("hourly", {}),
        "daily_units": data.get("daily_units", {}),
        "hourly_units": data.get("hourly_units", {}),
    }
