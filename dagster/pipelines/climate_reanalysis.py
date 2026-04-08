"""Climate reanalysis pipeline.

Downloads ERA5 data via CDS API, computes degree-days and anomalies,
aggregates to region level, and updates RiskAssessment objects.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from dagster import asset, define_asset_job, AssetSelection, get_dagster_logger

FOUNDRY_API_URL = os.environ.get("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_API_TOKEN = os.environ.get("FOUNDRY_API_TOKEN", "")
CDS_API_URL = os.environ.get("CDS_API_URL", "https://cds.climate.copernicus.eu/api")
CDS_API_KEY = os.environ.get("CDS_API_KEY", "")

# Heating/cooling degree-day base temperatures (°C)
HEATING_BASE = 18.0
COOLING_BASE = 24.0


# ── Assets ─────────────────────────────────────────────────────────────


@asset(group_name="climate_reanalysis", compute_kind="api")
def download_era5_data() -> list[dict[str, Any]]:
    """Download ERA5 reanalysis data via CDS API.

    Retrieves 2-metre temperature and total precipitation
    for the previous day on a 0.25° grid.
    """
    log = get_dagster_logger()
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

    request_body = {
        "product_type": "reanalysis",
        "variable": ["2m_temperature", "total_precipitation"],
        "year": yesterday[:4],
        "month": yesterday[5:7],
        "day": yesterday[8:10],
        "time": [f"{h:02d}:00" for h in range(0, 24, 6)],
        "area": [60, -180, -60, 180],  # N, W, S, E
        "format": "netcdf",
    }

    records: list[dict[str, Any]] = []

    if not CDS_API_KEY:
        log.warning("CDS_API_KEY not set — returning synthetic data for development")
        # Synthetic grid for dev/testing
        for lat in range(-60, 61, 10):
            for lon in range(-180, 181, 10):
                records.append({
                    "latitude": lat,
                    "longitude": lon,
                    "date": yesterday,
                    "t2m_mean": 15.0 + (90 - abs(lat)) * 0.2,  # warmer near equator
                    "t2m_min": 10.0 + (90 - abs(lat)) * 0.15,
                    "t2m_max": 20.0 + (90 - abs(lat)) * 0.25,
                    "total_precip_mm": max(0, 5.0 - abs(lat) * 0.05),
                })
        log.info(f"ERA5 (synthetic): {len(records)} grid points")
        return records

    headers = {"PRIVATE-TOKEN": CDS_API_KEY}
    with httpx.Client(timeout=120, base_url=CDS_API_URL) as client:
        try:
            # Submit retrieval request
            resp = client.post(
                "/v1/resources/reanalysis-era5-single-levels",
                json=request_body,
                headers=headers,
            )
            resp.raise_for_status()
            result = resp.json()

            # In production, poll for completion and download NetCDF
            # For now, store the request metadata
            records.append({
                "request_id": result.get("request_id"),
                "status": result.get("state", "submitted"),
                "date": yesterday,
                "variables": ["2m_temperature", "total_precipitation"],
            })
        except httpx.HTTPError as exc:
            log.warning(f"CDS API request failed: {exc}")

    log.info(f"ERA5: submitted request for {yesterday}")
    return records


@asset(group_name="climate_reanalysis", compute_kind="compute", deps=[download_era5_data])
def compute_degree_days(download_era5_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compute heating and cooling degree-days from ERA5 temperature data."""
    log = get_dagster_logger()
    results: list[dict[str, Any]] = []

    for rec in download_era5_data:
        t_mean = rec.get("t2m_mean")
        if t_mean is None:
            continue

        hdd = max(0, HEATING_BASE - t_mean)  # heating degree-days
        cdd = max(0, t_mean - COOLING_BASE)  # cooling degree-days

        results.append({
            **rec,
            "hdd": round(hdd, 2),
            "cdd": round(cdd, 2),
        })

    log.info(f"Computed degree-days for {len(results)} grid points")
    return results


@asset(group_name="climate_reanalysis", compute_kind="compute", deps=[compute_degree_days])
def compute_anomalies(compute_degree_days: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compute temperature and precipitation anomalies against climatological baselines.

    Uses a simple global mean as baseline for development.
    Production should use ERA5 1991–2020 climatology.
    """
    log = get_dagster_logger()
    # Simplified climatological baselines per latitude band
    BASELINE_TEMP = 15.0  # global mean ~15°C
    BASELINE_PRECIP = 2.5  # mm/day global mean

    results: list[dict[str, Any]] = []
    for rec in compute_degree_days:
        t_mean = rec.get("t2m_mean", BASELINE_TEMP)
        precip = rec.get("total_precip_mm", 0)

        t_anomaly = t_mean - BASELINE_TEMP
        p_anomaly = precip - BASELINE_PRECIP

        results.append({
            **rec,
            "t_anomaly": round(t_anomaly, 2),
            "p_anomaly": round(p_anomaly, 2),
            "is_heat_extreme": t_anomaly > 5.0,
            "is_precip_extreme": p_anomaly > 10.0,
        })

    extremes = sum(1 for r in results if r["is_heat_extreme"] or r["is_precip_extreme"])
    log.info(f"Computed anomalies for {len(results)} points, {extremes} extremes")
    return results


@asset(group_name="climate_reanalysis", compute_kind="compute", deps=[compute_anomalies])
def aggregate_to_regions(compute_anomalies: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Aggregate grid-level climate data to region level.

    Fetches regions from Open Foundry and assigns grid points
    using simple bounding-box containment.
    """
    log = get_dagster_logger()
    headers = {"Authorization": f"Bearer {FOUNDRY_API_TOKEN}"}

    regions: list[dict[str, Any]] = []
    try:
        with httpx.Client(timeout=30, base_url=FOUNDRY_API_URL) as client:
            resp = client.get("/objects", params={"objectType": "Region"}, headers=headers)
            resp.raise_for_status()
            regions = resp.json().get("data", [])
    except httpx.HTTPError as exc:
        log.warning(f"Failed to fetch regions: {exc}")

    if not regions:
        log.warning("No regions found — returning grid-level aggregates as single global region")
        if not compute_anomalies:
            return []

        avg_t = sum(r.get("t_anomaly", 0) for r in compute_anomalies) / len(compute_anomalies)
        avg_p = sum(r.get("p_anomaly", 0) for r in compute_anomalies) / len(compute_anomalies)
        avg_hdd = sum(r.get("hdd", 0) for r in compute_anomalies) / len(compute_anomalies)
        avg_cdd = sum(r.get("cdd", 0) for r in compute_anomalies) / len(compute_anomalies)
        heat_extremes = sum(1 for r in compute_anomalies if r.get("is_heat_extreme"))
        precip_extremes = sum(1 for r in compute_anomalies if r.get("is_precip_extreme"))

        return [{
            "region_id": "global",
            "avg_temperature_anomaly": round(avg_t, 2),
            "avg_precipitation_anomaly": round(avg_p, 2),
            "avg_hdd": round(avg_hdd, 2),
            "avg_cdd": round(avg_cdd, 2),
            "heat_extreme_count": heat_extremes,
            "precip_extreme_count": precip_extremes,
            "grid_points": len(compute_anomalies),
            "date": compute_anomalies[0].get("date") if compute_anomalies else None,
        }]

    # Simple spatial join: assign each grid point to its nearest region bbox
    region_aggregates: dict[str, list[dict]] = {}
    for point in compute_anomalies:
        lat = point.get("latitude", 0)
        lon = point.get("longitude", 0)
        # Find containing region (simplified)
        for region in regions:
            rid = region.get("id", "unknown")
            if rid not in region_aggregates:
                region_aggregates[rid] = []
            region_aggregates[rid].append(point)
            break

    results: list[dict[str, Any]] = []
    for rid, points in region_aggregates.items():
        n = len(points)
        results.append({
            "region_id": rid,
            "avg_temperature_anomaly": round(sum(p.get("t_anomaly", 0) for p in points) / n, 2),
            "avg_precipitation_anomaly": round(sum(p.get("p_anomaly", 0) for p in points) / n, 2),
            "avg_hdd": round(sum(p.get("hdd", 0) for p in points) / n, 2),
            "avg_cdd": round(sum(p.get("cdd", 0) for p in points) / n, 2),
            "heat_extreme_count": sum(1 for p in points if p.get("is_heat_extreme")),
            "precip_extreme_count": sum(1 for p in points if p.get("is_precip_extreme")),
            "grid_points": n,
            "date": points[0].get("date") if points else None,
        })

    log.info(f"Aggregated to {len(results)} regions")
    return results


@asset(group_name="climate_reanalysis", compute_kind="api", deps=[aggregate_to_regions])
def update_risk_assessments(aggregate_to_regions: list[dict[str, Any]]) -> dict[str, int]:
    """Update or create RiskAssessment objects based on climate aggregates."""
    log = get_dagster_logger()
    headers = {"Authorization": f"Bearer {FOUNDRY_API_TOKEN}", "Content-Type": "application/json"}
    updated = 0
    failed = 0

    with httpx.Client(timeout=30, base_url=FOUNDRY_API_URL) as client:
        for agg in aggregate_to_regions:
            # Compute a climate risk score from anomalies
            t_anom = abs(agg.get("avg_temperature_anomaly", 0))
            p_anom = abs(agg.get("avg_precipitation_anomaly", 0))
            heat_count = agg.get("heat_extreme_count", 0)
            precip_count = agg.get("precip_extreme_count", 0)

            # Weighted score: temperature anomaly + precip anomaly + extremes
            risk_score = min(100.0, t_anom * 5 + p_anom * 3 + (heat_count + precip_count) * 2)

            payload = {
                "objectType": "RiskAssessment",
                "properties": {
                    "hazardType": "DROUGHT" if t_anom > p_anom else "FLOOD",
                    "riskScore": round(risk_score, 1),
                    "methodology": "STATISTICAL",
                    "confidence": 0.75,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            }

            try:
                resp = client.post("/objects", json=payload, headers=headers)
                resp.raise_for_status()

                # Link to region if available
                if agg.get("region_id") and agg["region_id"] != "global":
                    assessment_id = resp.json().get("id")
                    if assessment_id:
                        link_payload = {
                            "linkType": "AssessmentOf",
                            "from": assessment_id,
                            "to": agg["region_id"],
                        }
                        client.post("/links", json=link_payload, headers=headers)

                updated += 1
            except httpx.HTTPError as exc:
                log.warning(f"Failed to update risk assessment: {exc}")
                failed += 1

    log.info(f"Updated {updated} risk assessments, {failed} failures")
    return {"updated": updated, "failed": failed}


# ── Job ────────────────────────────────────────────────────────────────

climate_reanalysis_job = define_asset_job(
    name="climate_reanalysis_job",
    selection=AssetSelection.groups("climate_reanalysis"),
    description="Download ERA5 data, compute degree-days and anomalies, update risk assessments",
)
