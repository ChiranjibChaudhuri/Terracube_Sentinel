"""Composite risk scoring pipeline.

Aggregates hazard data from Foundry, computes composite risk scores
per region, and updates Region.riskScore via the Foundry REST API.
Schedule: hourly.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any

import httpx
from dagster import asset, define_asset_job, AssetSelection, get_dagster_logger

FOUNDRY_API_URL = os.environ.get("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_API_TOKEN = os.environ.get("FOUNDRY_API_TOKEN", "")

# ── Weights for composite risk formula ─────────────────────────────────

W_HAZARD_FREQ = 0.4
W_AVG_SEVERITY = 0.3
W_INFRA_EXPOSURE = 0.2
W_SENSOR_GAP = 0.1  # applied as (1 - sensor_coverage)


# ── Common schema ──────────────────────────────────────────────────────


@dataclass
class RegionRiskScore:
    """Computed risk score for a region."""

    region_id: str
    region_name: str
    hazard_frequency: float
    avg_severity: float
    infrastructure_exposure: float
    sensor_coverage: float
    composite_risk: float
    timestamp: str


# ── Helpers ────────────────────────────────────────────────────────────


SEVERITY_SCORES: dict[str, float] = {
    "LOW": 0.1,
    "MODERATE": 0.4,
    "HIGH": 0.7,
    "CRITICAL": 1.0,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _compute_composite(
    hazard_frequency: float,
    avg_severity: float,
    infrastructure_exposure: float,
    sensor_coverage: float,
) -> float:
    """Compute composite risk score.

    Formula: 0.4 * hazard_frequency + 0.3 * avg_severity
             + 0.2 * infrastructure_exposure + 0.1 * (1 - sensor_coverage)

    All inputs should be normalised to [0, 1].
    Returns a score in [0, 1].
    """
    score = (
        W_HAZARD_FREQ * hazard_frequency
        + W_AVG_SEVERITY * avg_severity
        + W_INFRA_EXPOSURE * infrastructure_exposure
        + W_SENSOR_GAP * (1.0 - sensor_coverage)
    )
    return max(0.0, min(1.0, score))


# ── Assets ─────────────────────────────────────────────────────────────


@asset(group_name="risk_scoring", compute_kind="api")
def aggregate_hazard_data() -> list[dict[str, Any]]:
    """Query existing hazard data from Foundry and aggregate by region.

    Fetches HazardEvent objects via GET /objects?objectType=HazardEvent
    and groups them by the region they fall within.
    """
    log = get_dagster_logger()
    headers = {"Authorization": f"Bearer {FOUNDRY_API_TOKEN}"}
    hazards: list[dict[str, Any]] = []

    with httpx.Client(timeout=30, base_url=FOUNDRY_API_URL) as client:
        # Fetch hazard events
        try:
            resp = client.get(
                "/objects",
                params={"objectType": "HazardEvent"},
                headers=headers,
            )
            resp.raise_for_status()
            hazards = resp.json().get("data", [])
        except httpx.HTTPError as exc:
            log.warning(f"Failed to fetch hazard events: {exc}")

        # Fetch regions for grouping
        regions: list[dict[str, Any]] = []
        try:
            resp = client.get(
                "/objects",
                params={"objectType": "Region"},
                headers=headers,
            )
            resp.raise_for_status()
            regions = resp.json().get("data", [])
        except httpx.HTTPError as exc:
            log.warning(f"Failed to fetch regions: {exc}")

        # Fetch infrastructure assets for exposure calculation
        infra_assets: list[dict[str, Any]] = []
        try:
            resp = client.get(
                "/objects",
                params={"objectType": "InfrastructureAsset"},
                headers=headers,
            )
            resp.raise_for_status()
            infra_assets = resp.json().get("data", [])
        except httpx.HTTPError as exc:
            log.warning(f"Failed to fetch infrastructure assets: {exc}")

        # Fetch sensor deployments for coverage calculation
        sensors: list[dict[str, Any]] = []
        try:
            resp = client.get(
                "/objects",
                params={"objectType": "SensorDeployment"},
                headers=headers,
            )
            resp.raise_for_status()
            sensors = resp.json().get("data", [])
        except httpx.HTTPError as exc:
            log.warning(f"Failed to fetch sensor deployments: {exc}")

    # Build per-region aggregates
    region_data: list[dict[str, Any]] = []

    if not regions:
        log.warning(
            "No regions found -- returning single global aggregate"
        )
        total = len(hazards)
        severity_vals = [
            SEVERITY_SCORES.get(
                (h.get("properties") or h).get("severity", "LOW"), 0.1
            )
            for h in hazards
        ]
        avg_sev = (
            sum(severity_vals) / len(severity_vals) if severity_vals else 0.0
        )

        exposed = sum(
            1
            for a in infra_assets
            if (a.get("properties") or a).get("exposureLevel", "NONE")
            != "NONE"
        )
        infra_exposure = (
            exposed / len(infra_assets) if infra_assets else 0.0
        )

        active_sensors = sum(
            1
            for s in sensors
            if (s.get("properties") or s).get("status") == "ACTIVE"
        )
        sensor_coverage = (
            active_sensors / max(len(sensors), 1)
        )

        # Normalise hazard frequency to [0, 1] — cap at 100 events
        hazard_freq = min(1.0, total / 100.0)

        region_data.append({
            "region_id": "global",
            "region_name": "Global",
            "hazard_count": total,
            "hazard_frequency": hazard_freq,
            "avg_severity": avg_sev,
            "infrastructure_exposure": infra_exposure,
            "sensor_coverage": sensor_coverage,
            "hazards": hazards,
        })
    else:
        for region in regions:
            rid = region.get("id", "unknown")
            rname = (region.get("properties") or region).get("name", rid)

            # Simplified: assign all hazards to each region for now.
            # Production would use spatial containment checks.
            region_hazards = hazards
            total = len(region_hazards)

            severity_vals = [
                SEVERITY_SCORES.get(
                    (h.get("properties") or h).get("severity", "LOW"), 0.1
                )
                for h in region_hazards
            ]
            avg_sev = (
                sum(severity_vals) / len(severity_vals)
                if severity_vals
                else 0.0
            )

            exposed = sum(
                1
                for a in infra_assets
                if (a.get("properties") or a).get("exposureLevel", "NONE")
                != "NONE"
            )
            infra_exposure = (
                exposed / len(infra_assets) if infra_assets else 0.0
            )

            active_sensors = sum(
                1
                for s in sensors
                if (s.get("properties") or s).get("status") == "ACTIVE"
            )
            sensor_coverage = active_sensors / max(len(sensors), 1)

            hazard_freq = min(1.0, total / 100.0)

            region_data.append({
                "region_id": rid,
                "region_name": rname,
                "hazard_count": total,
                "hazard_frequency": hazard_freq,
                "avg_severity": avg_sev,
                "infrastructure_exposure": infra_exposure,
                "sensor_coverage": sensor_coverage,
            })

    log.info(
        f"Aggregated hazard data for {len(region_data)} regions "
        f"({len(hazards)} total hazard events)"
    )
    return region_data


@asset(
    group_name="risk_scoring",
    compute_kind="compute",
    deps=[aggregate_hazard_data],
)
def compute_composite_risk(
    aggregate_hazard_data: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Compute composite risk score per region.

    Formula:
        0.4 * hazard_frequency
      + 0.3 * avg_severity
      + 0.2 * infrastructure_exposure
      + 0.1 * (1 - sensor_coverage)

    All inputs normalised to [0, 1], output in [0, 1].
    """
    log = get_dagster_logger()
    results: list[dict[str, Any]] = []

    for region in aggregate_hazard_data:
        hazard_freq = region.get("hazard_frequency", 0.0)
        avg_sev = region.get("avg_severity", 0.0)
        infra_exp = region.get("infrastructure_exposure", 0.0)
        sensor_cov = region.get("sensor_coverage", 0.0)

        composite = _compute_composite(
            hazard_frequency=hazard_freq,
            avg_severity=avg_sev,
            infrastructure_exposure=infra_exp,
            sensor_coverage=sensor_cov,
        )

        results.append(
            asdict(
                RegionRiskScore(
                    region_id=region.get("region_id", "unknown"),
                    region_name=region.get("region_name", "Unknown"),
                    hazard_frequency=hazard_freq,
                    avg_severity=avg_sev,
                    infrastructure_exposure=infra_exp,
                    sensor_coverage=sensor_cov,
                    composite_risk=round(composite, 4),
                    timestamp=_now_iso(),
                )
            )
        )

    log.info(
        f"Computed composite risk for {len(results)} regions"
    )
    return results


@asset(
    group_name="risk_scoring",
    compute_kind="api",
    deps=[compute_composite_risk],
)
def update_region_risk_scores(
    compute_composite_risk: list[dict[str, Any]],
) -> dict[str, int]:
    """Update Region.riskScore in Foundry via PATCH /objects/{id}."""
    log = get_dagster_logger()
    headers = {
        "Authorization": f"Bearer {FOUNDRY_API_TOKEN}",
        "Content-Type": "application/json",
    }
    updated = 0
    failed = 0

    with httpx.Client(timeout=30, base_url=FOUNDRY_API_URL) as client:
        for score_rec in compute_composite_risk:
            region_id = score_rec["region_id"]

            if region_id == "global":
                # No specific region to patch — create a RiskAssessment instead
                payload = {
                    "objectType": "RiskAssessment",
                    "properties": {
                        "hazardType": "COMPOSITE",
                        "riskScore": round(
                            score_rec["composite_risk"] * 100, 1
                        ),
                        "methodology": "WEIGHTED_COMPOSITE",
                        "confidence": 0.8,
                        "timestamp": score_rec["timestamp"],
                    },
                }
                try:
                    resp = client.post(
                        "/objects", json=payload, headers=headers
                    )
                    resp.raise_for_status()
                    updated += 1
                except httpx.HTTPError as exc:
                    log.warning(
                        f"Failed to create global risk assessment: {exc}"
                    )
                    failed += 1
                continue

            # Patch region risk score
            patch_payload = {
                "properties": {
                    "riskScore": round(
                        score_rec["composite_risk"] * 100, 1
                    ),
                },
            }
            try:
                resp = client.patch(
                    f"/objects/{region_id}",
                    json=patch_payload,
                    headers=headers,
                )
                resp.raise_for_status()
                updated += 1
            except httpx.HTTPError as exc:
                log.warning(
                    f"Failed to update risk score for region "
                    f"{region_id}: {exc}"
                )
                failed += 1

    log.info(
        f"Updated {updated} region risk scores, {failed} failures"
    )
    return {"updated": updated, "failed": failed}


# ── Job ────────────────────────────────────────────────────────────────

risk_scoring_job = define_asset_job(
    name="risk_scoring_job",
    selection=AssetSelection.groups("risk_scoring"),
    description="Aggregate hazard data, compute composite risk, and update region risk scores",
)

# Schedule: hourly — cron_schedule="0 * * * *"
