"""Social signals pipeline.

Sources: GDELT Global Knowledge Graph (events + tone/sentiment).
Schedule: every 15 minutes.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any

import httpx
from dagster import asset, define_asset_job, AssetSelection, get_dagster_logger

FOUNDRY_API_URL = os.environ.get("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_API_TOKEN = os.environ.get("FOUNDRY_API_TOKEN", "")

GDELT_DOC_API = "http://api.gdeltproject.org/api/v2/doc/doc"

# Natural disaster keywords used to filter GDELT events
DISASTER_KEYWORDS = [
    "earthquake",
    "flood",
    "wildfire",
    "storm",
    "tsunami",
    "volcano",
]


# ── Common schema ──────────────────────────────────────────────────────


@dataclass
class SocialSignalRecord:
    """Normalised social signal record."""

    source: str
    event_type: str
    title: str
    url: str
    tone_score: float
    sentiment: str  # POSITIVE, NEGATIVE, NEUTRAL
    geometry: dict = field(default_factory=dict)  # GeoJSON Point
    timestamp: str = ""
    keywords: list[str] = field(default_factory=list)


# ── Helpers ────────────────────────────────────────────────────────────


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sentiment_from_tone(tone: float) -> str:
    """Map GDELT average tone to a discrete sentiment label."""
    if tone > 1.0:
        return "POSITIVE"
    if tone < -1.0:
        return "NEGATIVE"
    return "NEUTRAL"


def _classify_event_type(title: str) -> str:
    """Classify disaster type from article title using keyword matching."""
    lower = title.lower()
    for kw in DISASTER_KEYWORDS:
        if kw in lower:
            return kw.upper()
    return "NATURAL_DISASTER"


# ── Assets ─────────────────────────────────────────────────────────────


@asset(group_name="social_signals", compute_kind="api")
def fetch_gdelt_events() -> list[dict[str, Any]]:
    """Fetch recent events from GDELT filtered by natural disaster keywords.

    Uses the GDELT DOC 2.0 API with article-list mode to retrieve
    recent articles mentioning natural disasters.
    """
    log = get_dagster_logger()
    records: list[dict[str, Any]] = []

    query = " OR ".join(DISASTER_KEYWORDS)

    with httpx.Client(timeout=60) as client:
        try:
            resp = client.get(
                GDELT_DOC_API,
                params={
                    "query": query,
                    "mode": "artlist",
                    "maxrecords": "75",
                    "format": "json",
                    "sort": "datedesc",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            for article in data.get("articles", []):
                title = article.get("title", "")
                url = article.get("url", "")
                seendate = article.get("seendate", "")

                # Parse GDELT date format (YYYYMMDDTHHmmSS) to ISO
                timestamp = _now_iso()
                if seendate:
                    try:
                        dt = datetime.strptime(seendate, "%Y%m%dT%H%M%S")
                        timestamp = dt.replace(tzinfo=timezone.utc).isoformat()
                    except ValueError:
                        pass

                # GDELT may include source lat/lon
                source_lat = article.get("sourcelat")
                source_lon = article.get("sourcelon")
                geometry: dict[str, Any] = {}
                if source_lat and source_lon:
                    try:
                        geometry = {
                            "type": "Point",
                            "coordinates": [
                                float(source_lon),
                                float(source_lat),
                            ],
                        }
                    except (ValueError, TypeError):
                        pass

                # Determine matching keywords
                lower_title = title.lower()
                matched_keywords = [
                    kw for kw in DISASTER_KEYWORDS if kw in lower_title
                ]

                records.append({
                    "title": title,
                    "url": url,
                    "timestamp": timestamp,
                    "geometry": geometry,
                    "event_type": _classify_event_type(title),
                    "keywords": matched_keywords,
                    "domain": article.get("domain", ""),
                    "language": article.get("language", ""),
                })

        except httpx.HTTPError as exc:
            log.warning(f"GDELT events fetch failed: {exc}")

    log.info(f"GDELT events: {len(records)} articles")
    return records


@asset(group_name="social_signals", compute_kind="api")
def fetch_gdelt_tone() -> list[dict[str, Any]]:
    """Analyse tone/sentiment of recent disaster-related articles via GDELT.

    Uses the GDELT DOC 2.0 API in tone-chart mode to retrieve
    aggregate tone scores for each disaster keyword.
    """
    log = get_dagster_logger()
    records: list[dict[str, Any]] = []

    with httpx.Client(timeout=60) as client:
        for keyword in DISASTER_KEYWORDS:
            try:
                resp = client.get(
                    GDELT_DOC_API,
                    params={
                        "query": keyword,
                        "mode": "tonechart",
                        "format": "json",
                    },
                )
                resp.raise_for_status()
                data = resp.json()

                # tonechart returns a list of date-tone pairs
                for entry in data.get("tonechart", []):
                    date_str = entry.get("date", "")
                    tone = entry.get("tone", 0.0)

                    timestamp = _now_iso()
                    if date_str:
                        try:
                            dt = datetime.strptime(date_str, "%Y%m%d%H%M%S")
                            timestamp = dt.replace(
                                tzinfo=timezone.utc
                            ).isoformat()
                        except ValueError:
                            pass

                    records.append({
                        "keyword": keyword,
                        "tone_score": float(tone),
                        "sentiment": _sentiment_from_tone(float(tone)),
                        "timestamp": timestamp,
                    })

            except httpx.HTTPError as exc:
                log.warning(f"GDELT tone fetch failed for '{keyword}': {exc}")

    log.info(f"GDELT tone: {len(records)} tone entries")
    return records


@asset(
    group_name="social_signals",
    compute_kind="transform",
    deps=[fetch_gdelt_events, fetch_gdelt_tone],
)
def normalize_social_signals(
    fetch_gdelt_events: list[dict[str, Any]],
    fetch_gdelt_tone: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Combine event articles with tone data into SocialSignalRecord dicts."""
    log = get_dagster_logger()

    # Build a keyword -> latest tone lookup from tone data
    tone_by_keyword: dict[str, float] = {}
    for tone_rec in fetch_gdelt_tone:
        kw = tone_rec.get("keyword", "")
        score = tone_rec.get("tone_score", 0.0)
        # Keep the most recent tone per keyword (list is chronological)
        tone_by_keyword[kw] = score

    all_records: list[dict[str, Any]] = []

    for event in fetch_gdelt_events:
        matched_keywords = event.get("keywords", [])
        # Average tone across matched keywords, fallback to 0.0
        tone_scores = [
            tone_by_keyword[kw]
            for kw in matched_keywords
            if kw in tone_by_keyword
        ]
        avg_tone = (
            sum(tone_scores) / len(tone_scores) if tone_scores else 0.0
        )

        all_records.append(
            asdict(
                SocialSignalRecord(
                    source="gdelt",
                    event_type=event.get("event_type", "NATURAL_DISASTER"),
                    title=event.get("title", ""),
                    url=event.get("url", ""),
                    tone_score=round(avg_tone, 3),
                    sentiment=_sentiment_from_tone(avg_tone),
                    geometry=event.get("geometry", {}),
                    timestamp=event.get("timestamp", _now_iso()),
                    keywords=matched_keywords,
                )
            )
        )

    # Deduplicate by URL
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for rec in all_records:
        url = rec["url"]
        if url and url not in seen:
            seen.add(url)
            deduped.append(rec)
        elif not url:
            deduped.append(rec)

    log.info(
        f"Normalized {len(all_records)} -> {len(deduped)} social signal "
        f"records after dedup"
    )
    return deduped


# ── Job ────────────────────────────────────────────────────────────────

social_signals_job = define_asset_job(
    name="social_signals_job",
    selection=AssetSelection.groups("social_signals"),
    description="Fetch disaster-related events and tone from GDELT, normalise into social signals",
)

# Schedule: every 15 minutes — cron_schedule="*/15 * * * *"
