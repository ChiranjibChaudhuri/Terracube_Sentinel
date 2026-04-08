"""AI-powered ingest helpers for TerraCube Sentinel.

Provides agent configuration and risk-scoring utilities that can be
used by Dagster pipelines or standalone scripts.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any


# ── Agent configuration ────────────────────────────────────────────────


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


# ── Weights for composite risk formula ─────────────────────────────────

W_HAZARD_FREQ = 0.4
W_AVG_SEVERITY = 0.3
W_INFRA_EXPOSURE = 0.2
W_SENSOR_GAP = 0.1  # applied as (1 - sensor_coverage)

FOUNDRY_API_URL = os.environ.get("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_API_TOKEN = os.environ.get("FOUNDRY_API_TOKEN", "")

SEVERITY_SCORES: dict[str, float] = {
    "LOW": 0.1,
    "MODERATE": 0.4,
    "HIGH": 0.7,
    "CRITICAL": 1.0,
}


# ── Risk scoring ───────────────────────────────────────────────────────


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

    Parameters
    ----------
    region_id:
        Unique identifier of the region in Foundry.
    region_geometry:
        GeoJSON geometry of the region (Polygon or MultiPolygon).
    hazard_history:
        List of past HazardEvent dicts, each with at least a ``severity``
        field (LOW / MODERATE / HIGH / CRITICAL).

    Returns
    -------
    float
        Composite risk score normalised to [0, 1].
    """
    import httpx  # local import to keep module importable without httpx at top-level

    headers = {"Authorization": f"Bearer {FOUNDRY_API_TOKEN}"}

    # 1. Hazard frequency — normalise count to [0, 1] (cap at 100 events)
    hazard_count = len(hazard_history)
    hazard_frequency = min(1.0, hazard_count / 100.0)

    # 2. Average severity
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

    # 3. Infrastructure exposure — query Foundry for assets in this region
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
                    if (a.get("properties") or a).get(
                        "exposureLevel", "NONE"
                    )
                    != "NONE"
                )
                infrastructure_exposure = exposed / len(assets)
        except httpx.HTTPError:
            pass

        # 4. Sensor coverage — query Foundry for sensors in this region
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

    # 5. Compute composite score
    composite = (
        W_HAZARD_FREQ * hazard_frequency
        + W_AVG_SEVERITY * avg_severity
        + W_INFRA_EXPOSURE * infrastructure_exposure
        + W_SENSOR_GAP * (1.0 - sensor_coverage)
    )

    return max(0.0, min(1.0, composite))
