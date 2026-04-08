"""Weather tools — forecast retrieval from Open-Meteo."""

from __future__ import annotations

import httpx


async def get_forecast(
    latitude: float,
    longitude: float,
    days: int = 7,
) -> dict:
    """Fetch weather forecast from Open-Meteo API.

    Returns temperature, precipitation, wind speed, and weather codes
    for the specified location and forecast horizon.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code",
        "timezone": "UTC",
        "forecast_days": days,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
        resp.raise_for_status()
        data = resp.json()

        daily = data.get("daily", {})
        return {
            "latitude": data.get("latitude"),
            "longitude": data.get("longitude"),
            "timezone": data.get("timezone"),
            "days": [
                {
                    "date": daily.get("time", [])[i] if i < len(daily.get("time", [])) else None,
                    "temp_max": daily.get("temperature_2m_max", [])[i] if i < len(daily.get("temperature_2m_max", [])) else None,
                    "temp_min": daily.get("temperature_2m_min", [])[i] if i < len(daily.get("temperature_2m_min", [])) else None,
                    "precipitation_mm": daily.get("precipitation_sum", [])[i] if i < len(daily.get("precipitation_sum", [])) else None,
                    "wind_max_kmh": daily.get("wind_speed_10m_max", [])[i] if i < len(daily.get("wind_speed_10m_max", [])) else None,
                    "weather_code": daily.get("weather_code", [])[i] if i < len(daily.get("weather_code", [])) else None,
                }
                for i in range(min(days, len(daily.get("time", []))))
            ],
        }
