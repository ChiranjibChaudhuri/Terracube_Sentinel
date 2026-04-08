"""Configuration for AI-powered data ingestion pipeline."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class LLMSettings:
    """LLM connection and inference settings."""

    base_url: str = field(
        default_factory=lambda: os.environ.get(
            "OLLAMA_BASE_URL", "http://localhost:11434"
        )
    )
    model: str = field(
        default_factory=lambda: os.environ.get("LLM_MODEL", "llama3")
    )
    temperature: float = 0.2
    max_tokens: int = 2048
    timeout: int = 30  # seconds


@dataclass
class QualityThresholds:
    """Thresholds for data quality assessment."""

    min_completeness: float = 0.5
    min_overall_quality: float = 0.4
    duplicate_similarity_threshold: float = 0.85


@dataclass
class FeatureFlags:
    """Feature flags for AI processing stages."""

    enable_llm_classification: bool = field(
        default_factory=lambda: os.environ.get(
            "AI_ENABLE_LLM_CLASSIFICATION", "true"
        ).lower() == "true"
    )
    enable_anomaly_detection: bool = field(
        default_factory=lambda: os.environ.get(
            "AI_ENABLE_ANOMALY_DETECTION", "true"
        ).lower() == "true"
    )
    enable_auto_mapping: bool = field(
        default_factory=lambda: os.environ.get(
            "AI_ENABLE_AUTO_MAPPING", "true"
        ).lower() == "true"
    )


# Sources that already produce well-structured data (skip LLM classification)
STRUCTURED_SOURCES = frozenset({
    "usgs",
    "firms",
    "opensky",
    "ais",
    "celestrak",
    "open_meteo",
    "openaq",
})

# Sources that produce unstructured / semi-structured data (need LLM)
UNSTRUCTURED_SOURCES = frozenset({
    "gdelt",
    "news",
    "social",
    "report",
})

# Source reliability scores (0-1)
SOURCE_RELIABILITY: dict[str, float] = {
    "usgs": 0.95,
    "firms": 0.90,
    "open_meteo": 0.90,
    "opensky": 0.85,
    "ais": 0.85,
    "celestrak": 0.90,
    "openaq": 0.85,
    "gdelt": 0.60,
    "news": 0.50,
    "social": 0.35,
    "report": 0.70,
}


@dataclass
class AIIngestConfig:
    """Top-level configuration aggregator."""

    llm: LLMSettings = field(default_factory=LLMSettings)
    quality: QualityThresholds = field(default_factory=QualityThresholds)
    flags: FeatureFlags = field(default_factory=FeatureFlags)

    foundry_api_url: str = field(
        default_factory=lambda: os.environ.get(
            "FOUNDRY_API_URL", "http://localhost:8080/api/v1"
        )
    )
    foundry_api_token: str = field(
        default_factory=lambda: os.environ.get("FOUNDRY_API_TOKEN", "")
    )
