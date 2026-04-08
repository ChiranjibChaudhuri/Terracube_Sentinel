"""AI-powered ingest layer for TerraCube Sentinel.

Provides LLM-driven classification, entity extraction, quality scoring,
anomaly detection, auto-ontology mapping, and summarisation.

Sub-modules
-----------
config           – pipeline-wide settings and feature flags
llm_client       – unified LLM abstraction (Ollama / OpenAI-compatible)
event_classifier – classify raw events into ODL ontology types
entity_extractor – extract entities from unstructured text
quality_scorer   – data-quality assessment and duplicate detection
anomaly_detector – statistical anomaly and schema-drift detection
auto_mapper      – auto-map source data to ODL object types
summarizer       – natural-language summaries and ingest reports
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

# Re-export key classes for convenience
from .config import (
    AIIngestConfig,
    FeatureFlags,
    LLMSettings,
    QualityThresholds,
    SOURCE_RELIABILITY,
    STRUCTURED_SOURCES,
    UNSTRUCTURED_SOURCES,
)
from .llm_client import LLMClient
from .event_classifier import classify_event, classify_events
from .entity_extractor import extract_entities, extract_from_gdelt, extract_from_news
from .quality_scorer import score_data_quality, detect_duplicates
from .anomaly_detector import detect_anomalies, detect_schema_drift
from .auto_mapper import map_to_ontology
from .summarizer import summarize_events, generate_ingest_report


# ── Legacy API (kept for backward compat with existing pipelines) ─────


@dataclass
class AgentConfig:
    """Configuration for an AI agent used in risk analysis."""

    model: str = "gpt-4o"
    temperature: float = 0.2
    tools: list[str] = field(default_factory=lambda: [
        "hazard_lookup",
        "infrastructure_query",
        "sensor_status",
        "geospatial_analysis",
    ])


# ── Weights for composite risk formula ────────────────────────────────

W_HAZARD_FREQ = 0.4
W_AVG_SEVERITY = 0.3
W_INFRA_EXPOSURE = 0.2
W_SENSOR_GAP = 0.1

FOUNDRY_API_URL = os.environ.get("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_API_TOKEN = os.environ.get("FOUNDRY_API_TOKEN", "")

SEVERITY_SCORES: dict[str, float] = {
    "LOW": 0.1,
    "MODERATE": 0.4,
    "HIGH": 0.7,
    "CRITICAL": 1.0,
}


async def score_risk_for_region(
    region_id: str,
    region_geometry: dict[str, Any],
    hazard_history: list[dict[str, Any]],
) -> float:
    """Compute a composite risk score for a region.

    Uses the weighted formula:
        0.4 * hazard_frequency
      + 0.3 * avg_severity
      + 0.2 * infrastructure_exposure
      + 0.1 * (1 - sensor_coverage)
    """
    import httpx

    headers = {"Authorization": f"Bearer {FOUNDRY_API_TOKEN}"}

    hazard_count = len(hazard_history)
    hazard_frequency = min(1.0, hazard_count / 100.0)

    if hazard_history:
        severity_vals = [
            SEVERITY_SCORES.get(
                (h.get("properties") or h).get("severity", "LOW"), 0.1
            )
            for h in hazard_history
        ]
        avg_severity = sum(severity_vals) / len(severity_vals)
    else:
        avg_severity = 0.0

    infrastructure_exposure = 0.0
    async with httpx.AsyncClient(
        timeout=30, base_url=FOUNDRY_API_URL
    ) as client:
        try:
            resp = await client.get(
                "/objects",
                params={"objectType": "InfrastructureAsset"},
                headers=headers,
            )
            resp.raise_for_status()
            assets = resp.json().get("data", [])
            if assets:
                exposed = sum(
                    1
                    for a in assets
                    if (a.get("properties") or a).get("exposureLevel", "NONE") != "NONE"
                )
                infrastructure_exposure = exposed / len(assets)
        except httpx.HTTPError:
            pass

        sensor_coverage = 0.0
        try:
            resp = await client.get(
                "/objects",
                params={"objectType": "SensorDeployment"},
                headers=headers,
            )
            resp.raise_for_status()
            sensors = resp.json().get("data", [])
            if sensors:
                active = sum(
                    1
                    for s in sensors
                    if (s.get("properties") or s).get("status") == "ACTIVE"
                )
                sensor_coverage = active / len(sensors)
        except httpx.HTTPError:
            pass

    composite = (
        W_HAZARD_FREQ * hazard_frequency
        + W_AVG_SEVERITY * avg_severity
        + W_INFRA_EXPOSURE * infrastructure_exposure
        + W_SENSOR_GAP * (1.0 - sensor_coverage)
    )

    return max(0.0, min(1.0, composite))
