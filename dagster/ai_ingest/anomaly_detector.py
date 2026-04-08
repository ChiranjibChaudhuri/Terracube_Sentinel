"""Statistical anomaly detection for data streams.

Detects unusual event frequency spikes, new categories in a region,
severity spikes, and schema drift — all using Python stdlib only.
"""

from __future__ import annotations

import logging
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


# ── Anomaly detection ─────────────────────────────────────────────────


def detect_anomalies(
    items: list[dict[str, Any]],
    history: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Run statistical anomaly checks on the current batch of items.

    Checks performed:
    1. Event frequency spike per region (z-score > 2)
    2. New category appearing in a region
    3. Severity spike (multiple HIGH/CRITICAL in a short window)

    Parameters
    ----------
    items:
        Current batch of classified/mapped items.
    history:
        Historical items from previous pipeline runs (e.g. last 7 days).
        If *None*, only severity-spike detection is possible.

    Returns
    -------
    list[dict]
        Each anomaly dict has: type, description, severity,
        affected_region, data_points.
    """
    anomalies: list[dict[str, Any]] = []
    history = history or []

    anomalies.extend(_detect_frequency_spike(items, history))
    anomalies.extend(_detect_new_categories(items, history))
    anomalies.extend(_detect_severity_spike(items))

    return anomalies


def _get_region(item: dict[str, Any]) -> str:
    props = item.get("properties", item)
    return str(
        props.get("region_id")
        or props.get("affectedArea")
        or props.get("region")
        or "unknown"
    )


def _get_category(item: dict[str, Any]) -> str:
    props = item.get("properties", item)
    return str(
        props.get("eventType")
        or props.get("conflictType")
        or item.get("object_type", "unknown")
    )


def _get_severity(item: dict[str, Any]) -> str:
    props = item.get("properties", item)
    return str(props.get("severity", item.get("severity", "LOW"))).upper()


# ── Frequency spike (z-score) ─────────────────────────────────────────


def _detect_frequency_spike(
    items: list[dict[str, Any]],
    history: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Flag regions where current event count is >2 std dev above the mean."""
    anomalies: list[dict[str, Any]] = []
    if not history:
        return anomalies

    # Compute historical daily counts per region
    hist_counts: dict[str, list[int]] = defaultdict(lambda: [0] * 7)

    for h in history:
        region = _get_region(h)
        props = h.get("properties", h)
        ts = props.get("timestamp") or props.get("startTime") or ""
        if not ts:
            continue
        try:
            dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
            age_days = (datetime.now(timezone.utc) - dt).days
            if 0 <= age_days < 7:
                hist_counts[region][age_days] += 1
        except (ValueError, TypeError):
            pass

    # Current batch counts
    current_counts: Counter[str] = Counter()
    for item in items:
        current_counts[_get_region(item)] += 1

    for region, current in current_counts.items():
        daily = hist_counts.get(region)
        if not daily or len(daily) < 2:
            continue
        mean = statistics.mean(daily)
        try:
            stdev = statistics.stdev(daily)
        except statistics.StatisticsError:
            continue
        if stdev == 0:
            continue
        z = (current - mean) / stdev
        if z > 2.0:
            anomalies.append({
                "type": "FREQUENCY_SPIKE",
                "description": (
                    f"Region '{region}' has {current} events in current batch "
                    f"(mean={mean:.1f}, stdev={stdev:.1f}, z={z:.2f})"
                ),
                "severity": "HIGH" if z > 3 else "MODERATE",
                "affected_region": region,
                "data_points": {
                    "current_count": current,
                    "mean": round(mean, 2),
                    "stdev": round(stdev, 2),
                    "z_score": round(z, 2),
                },
            })

    return anomalies


# ── New category in region ────────────────────────────────────────────


def _detect_new_categories(
    items: list[dict[str, Any]],
    history: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Flag when a category appears in a region for the first time."""
    anomalies: list[dict[str, Any]] = []
    if not history:
        return anomalies

    # Build set of (region, category) seen in history
    known: set[tuple[str, str]] = set()
    for h in history:
        known.add((_get_region(h), _get_category(h)))

    for item in items:
        region = _get_region(item)
        category = _get_category(item)
        pair = (region, category)
        if pair not in known and region != "unknown":
            anomalies.append({
                "type": "NEW_CATEGORY",
                "description": (
                    f"New event category '{category}' detected in region "
                    f"'{region}' (never seen before in history)"
                ),
                "severity": "LOW",
                "affected_region": region,
                "data_points": {"category": category},
            })
            known.add(pair)  # only flag once per batch

    return anomalies


# ── Severity spike ────────────────────────────────────────────────────


def _detect_severity_spike(
    items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Flag when multiple HIGH/CRITICAL events appear in the same batch."""
    anomalies: list[dict[str, Any]] = []

    high_crit: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        sev = _get_severity(item)
        if sev in ("HIGH", "CRITICAL"):
            region = _get_region(item)
            high_crit[region].append(item)

    for region, events in high_crit.items():
        if len(events) >= 2:
            anomalies.append({
                "type": "SEVERITY_SPIKE",
                "description": (
                    f"Region '{region}' has {len(events)} HIGH/CRITICAL "
                    f"events in a single batch"
                ),
                "severity": "HIGH",
                "affected_region": region,
                "data_points": {
                    "count": len(events),
                    "severities": [_get_severity(e) for e in events],
                },
            })

    return anomalies


# ── Schema drift detection ────────────────────────────────────────────


def detect_schema_drift(
    new_items: list[dict[str, Any]],
    expected_schema: dict[str, Any],
) -> list[str]:
    """Compare incoming data fields against the expected ODL schema.

    Parameters
    ----------
    new_items:
        List of data items to check.
    expected_schema:
        Dict mapping object_type -> list of expected field names.
        Example: ``{"HazardEvent": ["eventType", "severity", ...]}``

    Returns
    -------
    list[str]
        Human-readable drift descriptions.
    """
    drift_messages: list[str] = []
    seen_types: set[str] = set()

    for item in new_items:
        obj_type = item.get("object_type", "")
        if not obj_type or obj_type in seen_types:
            continue
        seen_types.add(obj_type)

        expected_fields = expected_schema.get(obj_type)
        if expected_fields is None:
            drift_messages.append(
                f"NEW_TYPE: Object type '{obj_type}' not in expected schema"
            )
            continue

        props = item.get("properties", item)
        actual_fields = set(props.keys()) if isinstance(props, dict) else set()
        expected_set = set(expected_fields)

        new_fields = actual_fields - expected_set
        missing_fields = expected_set - actual_fields

        if new_fields:
            drift_messages.append(
                f"NEW_FIELDS in {obj_type}: {', '.join(sorted(new_fields))}"
            )
        if missing_fields:
            drift_messages.append(
                f"MISSING_FIELDS in {obj_type}: {', '.join(sorted(missing_fields))}"
            )

    return drift_messages
