"""Pydantic schemas for validating external API responses."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class OpenSkyStateResponse(BaseModel):
    """OpenSky Network /states/all response."""
    time: int = 0
    states: list[list[Any]] | None = None


class USGSFeatureCollection(BaseModel):
    """USGS earthquake GeoJSON FeatureCollection."""
    type: str = "FeatureCollection"
    features: list[dict[str, Any]] = Field(default_factory=list)


class NWSAlertCollection(BaseModel):
    """NWS weather alerts GeoJSON FeatureCollection."""
    type: str = "FeatureCollection"
    features: list[dict[str, Any]] = Field(default_factory=list)


class CelesTrakSatellite(BaseModel):
    """Single CelesTrak satellite record (subset of fields)."""
    OBJECT_NAME: str = "UNKNOWN"
    NORAD_CAT_ID: int | str = ""
    INCLINATION: float = 0
    MEAN_MOTION: float = 0
    EPOCH: str = ""
    RA_OF_ASC_NODE: float = 0
    MEAN_ANOMALY: float = 0
    ECCENTRICITY: float = 0
    PERIOD: float | None = None

    class Config:
        extra = "allow"


class YahooQuoteResponse(BaseModel):
    """Yahoo Finance /v7/finance/quote wrapper."""
    quoteResponse: dict[str, Any] = Field(default_factory=dict)


class WorldBankResponse(BaseModel):
    """World Bank API paged response (second element contains data)."""
    data: list[dict[str, Any]] = Field(default_factory=list)


class AISVesselRecord(BaseModel):
    """AIS vessel position record."""
    MMSI: str | None = None
    mmsi: str | None = None
    LONGITUDE: float | None = None
    longitude: float | None = None
    LATITUDE: float | None = None
    latitude: float | None = None

    class Config:
        extra = "allow"


class FIRMSFireRecord(BaseModel):
    """Single FIRMS fire detection record."""
    latitude: str | float = "0"
    longitude: str | float = "0"
    confidence: str = ""
    frp: str | float | None = None

    class Config:
        extra = "allow"
