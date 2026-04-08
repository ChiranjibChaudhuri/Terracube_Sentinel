"""
Abstract base class for all data source adapters.
Provides unified fetch/normalize/cache lifecycle with graceful degradation.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any
import logging
import httpx

logger = logging.getLogger(__name__)


@dataclass
class GeoJSONFeature:
    """Standard GeoJSON Feature for normalized output."""
    type: str = "Feature"
    geometry: dict = field(default_factory=dict)
    properties: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


class BaseAdapter(ABC):
    """Abstract base for all source adapters."""

    def __init__(self):
        self._client: httpx.Client | None = None

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Unique identifier for this data source."""
        ...

    @property
    @abstractmethod
    def entity_type(self) -> str:
        """Ontology entity type produced by this adapter."""
        ...

    @abstractmethod
    def get_ttl(self) -> int:
        """Cache TTL in seconds for entities produced by this adapter."""
        ...

    @abstractmethod
    def fetch(self, **kwargs) -> list[dict]:
        """Fetch raw data from the upstream source. Returns list of raw records."""
        ...

    @abstractmethod
    def normalize(self, raw_records: list[dict]) -> list[GeoJSONFeature]:
        """Normalize raw records into GeoJSON Features for the unified API."""
        ...

    def health_check(self) -> bool:
        """Check if the upstream source is available. Returns True if healthy."""
        try:
            with httpx.Client(timeout=10) as client:
                resp = client.head(self._health_url())
                return resp.status_code < 500
        except Exception:
            return False

    def _health_url(self) -> str:
        """URL to check for health. Override in subclasses."""
        return ""

    def graceful_degradation(self, error: Exception) -> list[GeoJSONFeature]:
        """Return empty list on failure with logging. Override for custom behavior."""
        logger.warning(
            "Source %s failed with %s: %s — returning empty results",
            self.source_name, type(error).__name__, error,
        )
        return []

    def fetch_and_normalize(self, **kwargs) -> list[GeoJSONFeature]:
        """Full lifecycle: fetch, normalize, handle errors gracefully."""
        try:
            raw = self.fetch(**kwargs)
            return self.normalize(raw)
        except Exception as e:
            return self.graceful_degradation(e)

    def _get_client(self, timeout: float = 30.0) -> httpx.Client:
        if self._client is None or self._client.is_closed:
            self._client = httpx.Client(timeout=timeout)
        return self._client

    def close(self):
        if self._client and not self._client.is_closed:
            self._client.close()
