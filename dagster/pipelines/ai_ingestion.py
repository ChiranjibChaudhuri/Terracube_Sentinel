"""AI-powered data ingestion pipeline.

Orchestrates: fetch → classify → extract entities → quality check →
anomaly/duplicate detection → merge → ontology mapping → load → summarise.

Schedule: every 15 minutes.
"""

from __future__ import annotations

import os
import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Any

import httpx
from dagster import asset, define_asset_job, AssetSelection, get_dagster_logger

from ai_ingest.config import (
    AIIngestConfig,
    STRUCTURED_SOURCES,
    UNSTRUCTURED_SOURCES,
)
from ai_ingest.llm_client import LLMClient
from ai_ingest.event_classifier import classify_events
from ai_ingest.entity_extractor import extract_entities, extract_from_gdelt
from ai_ingest.quality_scorer import score_data_quality, detect_duplicates
from ai_ingest.anomaly_detector import detect_anomalies, detect_schema_drift
from ai_ingest.auto_mapper import map_to_ontology
from ai_ingest.summarizer import generate_ingest_report
from ai_ingest.event_classifier import ODL_OBJECT_TYPES

logger = logging.getLogger(__name__)

FOUNDRY_API_URL = os.environ.get("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_API_TOKEN = os.environ.get("FOUNDRY_API_TOKEN", "")

# ── Shared config / LLM client ───────────────────────────────────────

_config = AIIngestConfig()
_llm = LLMClient(_config.llm)


# ── Helpers ───────────────────────────────────────────────────────────


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _source_of(item: dict[str, Any]) -> str:
    """Best-effort source extraction from a raw event dict."""
    return str(
        item.get("source")
        or item.get("properties", {}).get("source")
        or "unknown"
    )


# ── Assets ────────────────────────────────────────────────────────────


@asset(group_name="ai_ingestion", compute_kind="api")
def fetch_raw_events() -> list[dict[str, Any]]:
    """Collect raw events from all available source adapters.

    Re-uses the existing adapter HTTP calls (USGS, FIRMS, OpenSky,
    GDELT, etc.) via the Foundry API's recent-events endpoint.  If
    Foundry is unreachable, returns an empty list so the pipeline
    doesn't crash.
    """
    log = get_dagster_logger()
    events: list[dict[str, Any]] = []

    # Pull recent events that the other pipelines have already loaded
    headers = {"Authorization": f"Bearer {FOUNDRY_API_TOKEN}"}
    sources_to_query = [
        ("HazardEvent", "hazard"),
        ("SocialSignal", "social"),
        ("Aircraft", "aircraft"),
        ("Vessel", "vessel"),
    ]

    with httpx.Client(timeout=30, base_url=FOUNDRY_API_URL) as client:
        for obj_type, fallback_src in sources_to_query:
            try:
                resp = client.get(
                    "/objects",
                    params={"objectType": obj_type, "pageSize": "200"},
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json().get("data", [])
                for item in data:
                    item.setdefault("source", fallback_src)
                    item["_fetched_at"] = _now_iso()
                events.extend(data)
            except httpx.HTTPError as exc:
                log.warning("Failed to fetch %s from Foundry: %s", obj_type, exc)

    log.info("fetch_raw_events: %d items from Foundry", len(events))
    return events


@asset(
    group_name="ai_ingestion",
    compute_kind="ai",
    deps=[fetch_raw_events],
)
def classify_with_ai(fetch_raw_events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Run AI classification on unstructured events.

    Structured sources (USGS, FIRMS, OpenSky, etc.) skip the LLM call;
    unstructured sources (GDELT, news) are classified via LLM.
    """
    log = get_dagster_logger()

    if not _config.flags.enable_llm_classification:
        log.info("LLM classification disabled by feature flag")
        return fetch_raw_events

    structured: list[dict[str, Any]] = []
    unstructured: list[dict[str, Any]] = []

    for item in fetch_raw_events:
        src = _source_of(item)
        if src in STRUCTURED_SOURCES:
            structured.append(item)
        else:
            unstructured.append(item)

    classified = []
    if unstructured:
        classified = classify_events(unstructured, llm=_llm, max_batch=10)
    else:
        classified = []

    log.info(
        "classify_with_ai: %d structured (pass-through), %d classified",
        len(structured), len(classified),
    )

    # Merge: structured items keep their existing data; classified items
    # get the LLM-enriched fields added.
    result = structured + classified
    return result


@asset(
    group_name="ai_ingestion",
    compute_kind="ai",
    deps=[classify_with_ai],
)
def ai_extract_entities(classify_with_ai: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Run entity extraction on classified events."""
    log = get_dagster_logger()

    enriched: list[dict[str, Any]] = []
    for item in classify_with_ai:
        src = _source_of(item)
        # Only run entity extraction on text-heavy sources
        if src in UNSTRUCTURED_SOURCES:
            text = (
                item.get("title", "")
                or item.get("properties", {}).get("title", "")
                or item.get("summary", "")
            )
            if text:
                if src == "gdelt":
                    extracted = extract_from_gdelt(item, llm=_llm)
                else:
                    extracted = {"source": src, "objects": extract_entities(text, llm=_llm)}
                item["_extracted_entities"] = extracted

        enriched.append(item)

    log.info("ai_extract_entities: processed %d items", len(enriched))
    return enriched


@asset(
    group_name="ai_ingestion",
    compute_kind="transform",
    deps=[ai_extract_entities],
)
def assess_quality(ai_extract_entities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Run quality scoring on all items."""
    log = get_dagster_logger()

    scored: list[dict[str, Any]] = []
    for item in ai_extract_entities:
        src = _source_of(item)
        quality = score_data_quality(item, src, _config.quality)
        item["_quality"] = quality
        scored.append(item)

    accepted = sum(1 for i in scored if i["_quality"]["recommendation"] in ("ACCEPT", "ACCEPT_WITH_FLAGS"))
    rejected = sum(1 for i in scored if i["_quality"]["recommendation"] == "REJECT")
    log.info("assess_quality: %d accepted, %d rejected, %d total", accepted, rejected, len(scored))
    return scored


@asset(
    group_name="ai_ingestion",
    compute_kind="transform",
    deps=[assess_quality],
)
def detect_anomalies_and_duplicates(
    assess_quality: list[dict[str, Any]],
) -> dict[str, Any]:
    """Run anomaly detection and duplicate grouping."""
    log = get_dagster_logger()

    anomalies: list[dict[str, Any]] = []
    if _config.flags.enable_anomaly_detection:
        anomalies = detect_anomalies(assess_quality, history=[])

    dup_groups = detect_duplicates(
        assess_quality,
        threshold=_config.quality.duplicate_similarity_threshold,
    )

    # Schema drift check
    expected_schema = {
        obj_type: schema["fields"]
        for obj_type, schema in ODL_OBJECT_TYPES.items()
    }
    drift = detect_schema_drift(assess_quality, expected_schema)

    log.info(
        "detect_anomalies_and_duplicates: %d anomalies, %d dup groups, %d drift warnings",
        len(anomalies), len(dup_groups), len(drift),
    )

    return {
        "items": assess_quality,
        "anomalies": anomalies,
        "duplicate_groups": dup_groups,
        "schema_drift": drift,
    }


@asset(
    group_name="ai_ingestion",
    compute_kind="transform",
    deps=[detect_anomalies_and_duplicates],
)
def merge_and_deduplicate(
    detect_anomalies_and_duplicates: dict[str, Any],
) -> list[dict[str, Any]]:
    """Merge duplicate events, keeping the highest-quality version."""
    log = get_dagster_logger()

    items: list[dict[str, Any]] = detect_anomalies_and_duplicates["items"]
    dup_groups: list[list[int]] = detect_anomalies_and_duplicates["duplicate_groups"]

    # Collect indices to remove (keep the one with highest quality in each group)
    to_remove: set[int] = set()
    for group in dup_groups:
        best_idx = max(
            group,
            key=lambda idx: items[idx].get("_quality", {}).get("overall_quality", 0),
        )
        for idx in group:
            if idx != best_idx:
                to_remove.add(idx)

    deduped = [item for i, item in enumerate(items) if i not in to_remove]

    log.info(
        "merge_and_deduplicate: %d -> %d items (%d duplicates removed)",
        len(items), len(deduped), len(to_remove),
    )
    return deduped


@asset(
    group_name="ai_ingestion",
    compute_kind="ai",
    deps=[merge_and_deduplicate],
)
def ai_map_to_ontology(merge_and_deduplicate: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Map all accepted items to ODL ontology objects."""
    log = get_dagster_logger()

    if not _config.flags.enable_auto_mapping:
        log.info("Auto-mapping disabled by feature flag")
        return merge_and_deduplicate

    mapped: list[dict[str, Any]] = []
    for item in merge_and_deduplicate:
        quality = item.get("_quality", {})
        recommendation = quality.get("recommendation", "ACCEPT")

        # Skip rejected items
        if recommendation == "REJECT":
            continue

        src = _source_of(item)
        mapped_obj = map_to_ontology(item, src, llm=_llm)

        # Attach quality metadata
        mapped_obj["properties"]["qualityScore"] = quality.get("overall_quality", 0)
        mapped_obj["properties"]["aiConfidence"] = item.get("confidence", quality.get("source_reliability", 0.5))
        mapped_obj["properties"]["aiProcessedAt"] = _now_iso()

        mapped.append(mapped_obj)

    log.info("ai_map_to_ontology: %d items mapped", len(mapped))
    return mapped


@asset(
    group_name="ai_ingestion",
    compute_kind="api",
    deps=[ai_map_to_ontology],
)
def load_to_foundry(ai_map_to_ontology: list[dict[str, Any]]) -> dict[str, Any]:
    """POST mapped objects to Open Foundry API."""
    log = get_dagster_logger()

    headers = {
        "Authorization": f"Bearer {FOUNDRY_API_TOKEN}",
        "Content-Type": "application/json",
    }

    loaded = 0
    failed = 0

    with httpx.Client(timeout=30, base_url=FOUNDRY_API_URL) as client:
        for obj in ai_map_to_ontology:
            try:
                resp = client.post(
                    "/objects",
                    json={
                        "objectType": obj.get("object_type", "HazardEvent"),
                        "properties": obj.get("properties", {}),
                        "links": obj.get("links", {}),
                    },
                    headers=headers,
                )
                resp.raise_for_status()
                loaded += 1
            except httpx.HTTPError as exc:
                failed += 1
                if failed <= 5:
                    log.warning("Failed to load object to Foundry: %s", exc)

    if failed > 5:
        log.warning("load_to_foundry: suppressed %d additional failure warnings", failed - 5)
    log.info("load_to_foundry: %d loaded, %d failed", loaded, failed)
    return {"loaded": loaded, "failed": failed}


@asset(
    group_name="ai_ingestion",
    compute_kind="ai",
    deps=[
        ai_map_to_ontology,
        load_to_foundry,
        detect_anomalies_and_duplicates,
    ],
)
def generate_ingest_summary(
    ai_map_to_ontology: list[dict[str, Any]],
    load_to_foundry: dict[str, Any],
    detect_anomalies_and_duplicates: dict[str, Any],
) -> str:
    """Generate a summary report for this pipeline run."""
    log = get_dagster_logger()

    # Build stats
    per_source: Counter[str] = Counter()
    per_type: Counter[str] = Counter()
    quality_sum: dict[str, float] = {
        "completeness": 0, "consistency": 0, "freshness": 0, "overall": 0,
    }
    n = len(ai_map_to_ontology) or 1

    for obj in ai_map_to_ontology:
        src = obj.get("properties", {}).get("source", "unknown")
        per_source[src] += 1
        per_type[obj.get("object_type", "unknown")] += 1
        q = obj.get("properties", {}).get("qualityScore", 0.5)
        quality_sum["overall"] += q

    stats = {
        "total_items": len(ai_map_to_ontology),
        "per_source": dict(per_source),
        "per_object_type": dict(per_type),
        "quality_scores": {
            "avg_overall": round(quality_sum["overall"] / n, 3),
        },
        "anomalies": detect_anomalies_and_duplicates.get("anomalies", []),
        "schema_drift": detect_anomalies_and_duplicates.get("schema_drift", []),
        "duplicates_found": len(detect_anomalies_and_duplicates.get("duplicate_groups", [])),
        "accepted": load_to_foundry.get("loaded", 0),
        "rejected": load_to_foundry.get("failed", 0),
    }

    report = generate_ingest_report(stats, llm=_llm)
    log.info("generate_ingest_summary:\n%s", report)
    return report


# ── Job ───────────────────────────────────────────────────────────────

ai_ingestion_job = define_asset_job(
    name="ai_ingestion_job",
    selection=AssetSelection.groups("ai_ingestion"),
    description=(
        "AI-powered data ingestion: classify, extract, score quality, "
        "detect anomalies, deduplicate, map to ontology, and load to Foundry"
    ),
)
