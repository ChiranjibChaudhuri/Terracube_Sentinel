"""AI data quality assessment and duplicate detection.

Scores incoming data on completeness, consistency, freshness, and source
reliability.  Implements TF-IDF + cosine similarity for duplicate detection
using only Python stdlib (no scikit-learn / numpy).
"""

from __future__ import annotations

import math
import re
import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from .config import SOURCE_RELIABILITY, QualityThresholds

logger = logging.getLogger(__name__)

# ── Quality scoring ───────────────────────────────────────────────────

# Required fields per object type
REQUIRED_FIELDS: dict[str, list[str]] = {
    "HazardEvent": ["eventType", "severity", "title", "geometry", "source"],
    "ArmedConflict": ["conflictType", "severity", "title", "geometry", "source"],
    "Aircraft": ["icao24", "latitude", "longitude"],
    "Vessel": ["mmsi", "latitude", "longitude"],
    "InfrastructureAsset": ["assetId", "assetType", "geometry"],
    "SatelliteObject": ["noradId", "name"],
    "SocialSignal": ["title", "source", "timestamp"],
}

# Accepted lat/lng ranges
_LAT_RANGE = (-90.0, 90.0)
_LNG_RANGE = (-180.0, 180.0)


def score_data_quality(
    item: dict[str, Any],
    source: str,
    thresholds: QualityThresholds | None = None,
) -> dict[str, Any]:
    """Assess quality of a single data item.

    Returns a dict with completeness_score, consistency_score,
    freshness_score, source_reliability, overall_quality, issues,
    and recommendation.
    """
    thresholds = thresholds or QualityThresholds()
    props = item.get("properties", item)
    object_type = item.get("object_type", "")
    issues: list[str] = []

    # 1. Completeness
    required = REQUIRED_FIELDS.get(object_type, ["title", "source"])
    present = sum(1 for f in required if props.get(f) is not None)
    completeness = present / len(required) if required else 1.0

    if completeness < thresholds.min_completeness:
        issues.append(f"Low completeness ({completeness:.0%}): missing fields")

    # 2. Consistency
    consistency_checks = 0
    consistency_pass = 0

    # Lat/lng range check
    lat = props.get("latitude") or (props.get("geometry", {}) or {}).get("coordinates", [None, None])
    lng = None
    if isinstance(lat, list) and len(lat) >= 2:
        lng, lat = lat[0], lat[1]  # GeoJSON is [lng, lat]

    if isinstance(lat, (int, float)):
        consistency_checks += 1
        if _LAT_RANGE[0] <= lat <= _LAT_RANGE[1]:
            consistency_pass += 1
        else:
            issues.append(f"Latitude {lat} out of range")

    if isinstance(lng, (int, float)):
        consistency_checks += 1
        if _LNG_RANGE[0] <= lng <= _LNG_RANGE[1]:
            consistency_pass += 1
        else:
            issues.append(f"Longitude {lng} out of range")

    # Severity check
    severity = props.get("severity")
    if severity:
        consistency_checks += 1
        if severity in ("LOW", "MODERATE", "HIGH", "CRITICAL"):
            consistency_pass += 1
        else:
            issues.append(f"Invalid severity: {severity}")

    # Date not in future check
    for date_field in ("timestamp", "startTime", "observedAt"):
        date_val = props.get(date_field)
        if date_val and isinstance(date_val, str):
            consistency_checks += 1
            try:
                dt = datetime.fromisoformat(date_val.replace("Z", "+00:00"))
                if dt <= datetime.now(timezone.utc):
                    consistency_pass += 1
                else:
                    issues.append(f"Future date in {date_field}: {date_val}")
            except (ValueError, TypeError):
                issues.append(f"Unparseable date in {date_field}: {date_val}")

    consistency = (
        consistency_pass / consistency_checks if consistency_checks > 0 else 1.0
    )

    # 3. Freshness
    freshness = 0.5  # default if no timestamp
    for date_field in ("timestamp", "startTime", "observedAt"):
        date_val = props.get(date_field)
        if date_val and isinstance(date_val, str):
            try:
                dt = datetime.fromisoformat(date_val.replace("Z", "+00:00"))
                age_hours = (
                    datetime.now(timezone.utc) - dt
                ).total_seconds() / 3600
                if age_hours <= 1:
                    freshness = 1.0
                elif age_hours <= 6:
                    freshness = 0.9
                elif age_hours <= 24:
                    freshness = 0.7
                elif age_hours <= 72:
                    freshness = 0.5
                elif age_hours <= 168:
                    freshness = 0.3
                else:
                    freshness = 0.1
                break
            except (ValueError, TypeError):
                pass

    # 4. Source reliability
    source_reliability = SOURCE_RELIABILITY.get(source, 0.5)

    # 5. Overall quality (weighted composite)
    overall = (
        0.30 * completeness
        + 0.25 * consistency
        + 0.20 * freshness
        + 0.25 * source_reliability
    )

    # 6. Recommendation
    if overall >= 0.75 and not issues:
        recommendation = "ACCEPT"
    elif overall >= 0.50:
        recommendation = "ACCEPT_WITH_FLAGS"
    elif overall >= 0.30:
        recommendation = "MANUAL_REVIEW"
    else:
        recommendation = "REJECT"

    return {
        "completeness_score": round(completeness, 3),
        "consistency_score": round(consistency, 3),
        "freshness_score": round(freshness, 3),
        "source_reliability": round(source_reliability, 3),
        "overall_quality": round(overall, 3),
        "issues": issues,
        "recommendation": recommendation,
    }


# ── TF-IDF + cosine similarity duplicate detection ───────────────────

_WORD_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> list[str]:
    """Lowercase tokenisation (alphanumeric words only)."""
    return _WORD_RE.findall(text.lower())


def _build_tfidf(documents: list[list[str]]) -> list[dict[str, float]]:
    """Compute TF-IDF vectors for a list of tokenised documents."""
    n_docs = len(documents)
    if n_docs == 0:
        return []

    # Document frequency
    df: Counter[str] = Counter()
    for doc in documents:
        df.update(set(doc))

    vectors: list[dict[str, float]] = []
    for doc in documents:
        tf = Counter(doc)
        n_terms = len(doc) or 1
        vec: dict[str, float] = {}
        for term, count in tf.items():
            idf = math.log((n_docs + 1) / (df[term] + 1)) + 1
            vec[term] = (count / n_terms) * idf
        vectors.append(vec)

    return vectors


def _cosine_similarity(a: dict[str, float], b: dict[str, float]) -> float:
    """Cosine similarity between two sparse TF-IDF vectors."""
    # Only iterate over shared keys for the dot product
    common = set(a) & set(b)
    if not common:
        return 0.0

    dot = sum(a[k] * b[k] for k in common)
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))

    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _item_text(item: dict[str, Any]) -> str:
    """Extract searchable text from an item for similarity comparison."""
    props = item.get("properties", item)
    parts = [
        str(props.get("title", "")),
        str(props.get("description", "")),
        str(props.get("summary", "")),
        str(props.get("eventType", "")),
    ]
    # Include location name if present
    geo = props.get("geometry", {})
    if isinstance(geo, dict):
        parts.append(str(geo.get("name", "")))
    return " ".join(parts)


def detect_duplicates(
    items: list[dict[str, Any]],
    threshold: float = 0.85,
) -> list[list[int]]:
    """Group items by text similarity using TF-IDF + cosine similarity.

    Returns a list of groups, where each group is a list of indices into
    *items* that likely refer to the same event.
    """
    if len(items) <= 1:
        return []

    texts = [_item_text(item) for item in items]
    tokenised = [_tokenize(t) for t in texts]
    vectors = _build_tfidf(tokenised)

    n = len(items)
    visited: set[int] = set()
    groups: list[list[int]] = []

    for i in range(n):
        if i in visited:
            continue
        group = [i]
        visited.add(i)
        for j in range(i + 1, n):
            if j in visited:
                continue
            sim = _cosine_similarity(vectors[i], vectors[j])
            if sim >= threshold:
                group.append(j)
                visited.add(j)
        if len(group) > 1:
            groups.append(group)

    return groups
