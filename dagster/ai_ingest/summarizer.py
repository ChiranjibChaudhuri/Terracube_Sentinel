"""AI summarisation for ingested data.

Generates natural-language summaries of recent events and
ingest-run reports using LLM (with template fallback).
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from .llm_client import LLMClient

logger = logging.getLogger(__name__)

SUMMARY_SYSTEM_PROMPT = """You are an intelligence analyst for TerraCube Sentinel.
Write concise, factual summaries suitable for a daily briefing.
Use bullet points for key developments. Do not speculate."""


def summarize_events(
    events: list[dict[str, Any]],
    region: str = "global",
    window: str = "24h",
    llm: LLMClient | None = None,
) -> str:
    """Generate a natural-language summary of recent events in a region.

    Parameters
    ----------
    events:
        List of classified/mapped event dicts.
    region:
        Region name or ID to summarise.
    window:
        Time window label (e.g. "24h", "7d") for context.
    llm:
        Pre-initialised LLM client.

    Returns
    -------
    str
        Markdown-formatted summary text.
    """
    if not events:
        return f"No events recorded for {region} in the last {window}."

    # Build statistics for the prompt (and for fallback)
    type_counts: Counter[str] = Counter()
    severity_counts: Counter[str] = Counter()
    for event in events:
        props = event.get("properties", event)
        type_counts[props.get("eventType", event.get("object_type", "unknown"))] += 1
        severity_counts[props.get("severity", event.get("severity", "LOW"))] += 1

    stats_text = _format_stats(type_counts, severity_counts, len(events), region, window)

    # Try LLM summary
    if llm is not None and llm.is_available():
        prompt = (
            f"Summarise the following event statistics for region '{region}' "
            f"over the last {window}:\n\n{stats_text}\n\n"
            f"Also here are sample event titles:\n"
        )
        for event in events[:10]:
            props = event.get("properties", event)
            title = props.get("title", "")
            if title:
                prompt += f"- {title}\n"

        result = llm.complete(prompt, system=SUMMARY_SYSTEM_PROMPT)
        if result:
            return result

    # Fallback: template-based summary
    return _template_summary(type_counts, severity_counts, len(events), region, window)


def generate_ingest_report(
    stats: dict[str, Any],
    llm: LLMClient | None = None,
) -> str:
    """Generate a report of the latest pipeline ingestion run.

    Parameters
    ----------
    stats:
        Dict with keys like ``total_items``, ``per_source``,
        ``per_object_type``, ``quality_scores``, ``anomalies``,
        ``duplicates_found``, ``accepted``, ``rejected``.
    llm:
        Pre-initialised LLM client.

    Returns
    -------
    str
        Markdown-formatted ingest report.
    """
    # Try LLM report
    if llm is not None and llm.is_available():
        import json
        prompt = (
            "Generate a concise pipeline ingestion report from these stats:\n\n"
            f"```json\n{json.dumps(stats, default=str, indent=2)}\n```"
        )
        result = llm.complete(prompt, system=SUMMARY_SYSTEM_PROMPT)
        if result:
            return result

    # Fallback: template-based report
    return _template_report(stats)


# ── Template helpers ──────────────────────────────────────────────────


def _format_stats(
    type_counts: Counter[str],
    severity_counts: Counter[str],
    total: int,
    region: str,
    window: str,
) -> str:
    lines = [
        f"Region: {region}",
        f"Time window: {window}",
        f"Total events: {total}",
        "",
        "Event types:",
    ]
    for etype, count in type_counts.most_common():
        lines.append(f"  - {etype}: {count}")
    lines.append("")
    lines.append("Severity distribution:")
    for sev, count in severity_counts.most_common():
        lines.append(f"  - {sev}: {count}")
    return "\n".join(lines)


def _template_summary(
    type_counts: Counter[str],
    severity_counts: Counter[str],
    total: int,
    region: str,
    window: str,
) -> str:
    """Generate a template-based summary (no LLM needed)."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    top_type = type_counts.most_common(1)[0][0] if type_counts else "unknown"
    high_crit = severity_counts.get("HIGH", 0) + severity_counts.get("CRITICAL", 0)

    trend = "stable"
    if high_crit > total * 0.3:
        trend = "escalating"
    elif high_crit == 0:
        trend = "calm"

    lines = [
        f"## Event Summary — {region} ({window})",
        f"*Generated {now}*",
        "",
        f"**{total}** events recorded across "
        f"**{len(type_counts)}** categories.",
        "",
        f"- Most common type: **{top_type}** "
        f"({type_counts[top_type]} events)",
        f"- HIGH/CRITICAL events: **{high_crit}**",
        f"- Trend: **{trend}**",
        "",
        "### Breakdown by type",
    ]
    for etype, count in type_counts.most_common():
        lines.append(f"- {etype}: {count}")
    lines.append("")
    lines.append("### Severity distribution")
    for sev in ("CRITICAL", "HIGH", "MODERATE", "LOW"):
        if severity_counts.get(sev, 0) > 0:
            lines.append(f"- {sev}: {severity_counts[sev]}")

    return "\n".join(lines)


def _template_report(stats: dict[str, Any]) -> str:
    """Generate a template-based ingest report."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    total = stats.get("total_items", 0)
    accepted = stats.get("accepted", 0)
    rejected = stats.get("rejected", 0)
    dupes = stats.get("duplicates_found", 0)

    lines = [
        f"## Ingestion Report",
        f"*Generated {now}*",
        "",
        f"- **Total items processed:** {total}",
        f"- **Accepted:** {accepted}",
        f"- **Rejected:** {rejected}",
        f"- **Duplicates found:** {dupes}",
    ]

    per_source = stats.get("per_source", {})
    if per_source:
        lines.append("")
        lines.append("### Items per source")
        for src, count in sorted(per_source.items(), key=lambda x: -x[1]):
            lines.append(f"- {src}: {count}")

    per_type = stats.get("per_object_type", {})
    if per_type:
        lines.append("")
        lines.append("### Items per object type")
        for otype, count in sorted(per_type.items(), key=lambda x: -x[1]):
            lines.append(f"- {otype}: {count}")

    quality = stats.get("quality_scores", {})
    if quality:
        lines.append("")
        lines.append("### Average quality scores")
        for metric, val in quality.items():
            lines.append(f"- {metric}: {val:.3f}" if isinstance(val, float) else f"- {metric}: {val}")

    anomalies = stats.get("anomalies", [])
    if anomalies:
        lines.append("")
        lines.append(f"### Anomalies detected: {len(anomalies)}")
        for a in anomalies[:5]:
            lines.append(f"- [{a.get('type', '?')}] {a.get('description', '')}")

    return "\n".join(lines)
