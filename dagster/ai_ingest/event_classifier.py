"""AI-powered event classification for incoming data.

Uses LLM to classify raw events into ontology object types, extract
structured fields, assess severity, and generate summaries.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from .llm_client import LLMClient
from .config import LLMSettings

logger = logging.getLogger(__name__)

# ── ODL schema definitions (provided to LLM as context) ──────────────

ODL_OBJECT_TYPES = {
    "HazardEvent": {
        "description": "Natural or man-made hazard event",
        "fields": [
            "eventId", "eventType", "severity", "title", "description",
            "startTime", "endTime", "geometry", "affectedArea",
            "casualties", "damageEstimate", "source",
        ],
        "event_types": [
            "EARTHQUAKE", "WILDFIRE", "FLOOD", "STORM", "TSUNAMI",
            "VOLCANO", "LANDSLIDE", "DROUGHT", "EPIDEMIC",
        ],
    },
    "ArmedConflict": {
        "description": "Armed conflict or military engagement",
        "fields": [
            "conflictId", "conflictType", "severity", "title", "description",
            "startTime", "geometry", "actors", "casualties", "source",
        ],
        "event_types": [
            "BATTLE", "BOMBING", "SHELLING", "AIRSTRIKE", "INSURGENCY",
            "RIOT", "PROTEST", "CIVIL_UNREST",
        ],
    },
    "Aircraft": {
        "description": "Tracked aircraft",
        "fields": [
            "icao24", "callsign", "origin", "destination",
            "latitude", "longitude", "altitude", "velocity", "heading",
        ],
    },
    "Vessel": {
        "description": "Tracked maritime vessel",
        "fields": [
            "mmsi", "name", "vesselType", "flag",
            "latitude", "longitude", "speed", "course", "destination",
        ],
    },
    "InfrastructureAsset": {
        "description": "Critical infrastructure element",
        "fields": [
            "assetId", "assetType", "name", "geometry",
            "condition", "exposureLevel", "vulnerabilityScore",
        ],
    },
    "SatelliteObject": {
        "description": "Tracked space object / satellite",
        "fields": [
            "noradId", "name", "objectType", "orbitType",
            "inclination", "period", "apogee", "perigee",
        ],
    },
    "SocialSignal": {
        "description": "Social media or news signal",
        "fields": [
            "title", "url", "source", "sentiment", "toneScore",
            "eventType", "geometry", "timestamp", "keywords",
        ],
    },
}

CLASSIFICATION_SYSTEM_PROMPT = """You are a geopolitical event classifier for the TerraCube Sentinel platform.
Given a raw event, determine the correct ontology object type, extract structured fields, and assess severity.

Valid object types: {types}

Respond ONLY with a JSON object containing:
{{
  "object_type": "<one of the valid types>",
  "severity": "LOW|MODERATE|HIGH|CRITICAL",
  "confidence": <float 0-1>,
  "title": "<brief title>",
  "summary": "<1-2 sentence summary>",
  "actors": [<list of involved parties/entities>],
  "properties": {{<extracted fields matching the object type schema>}}
}}""".format(types=", ".join(ODL_OBJECT_TYPES.keys()))

CLASSIFICATION_PROMPT_TEMPLATE = """Classify this event:

```json
{item}
```

Object type schemas for reference:
{schemas}
"""


def _build_schema_reference() -> str:
    """Build a compact schema reference string for the prompt."""
    lines = []
    for name, schema in ODL_OBJECT_TYPES.items():
        fields = ", ".join(schema["fields"])
        lines.append(f"- {name}: {schema['description']} — fields: [{fields}]")
    return "\n".join(lines)


_SCHEMA_REF = _build_schema_reference()


# ── Rule-based fallback ───────────────────────────────────────────────

_KEYWORD_TO_SEVERITY: dict[str, str] = {
    "earthquake": "HIGH",
    "tsunami": "CRITICAL",
    "wildfire": "HIGH",
    "flood": "MODERATE",
    "storm": "MODERATE",
    "volcano": "HIGH",
    "conflict": "HIGH",
    "battle": "CRITICAL",
    "bombing": "CRITICAL",
    "protest": "LOW",
    "riot": "MODERATE",
}


def _rule_based_classify(raw_event: dict[str, Any]) -> dict[str, Any]:
    """Fallback classifier when LLM is unavailable."""
    text = json.dumps(raw_event, default=str).lower()

    # Determine object type by keyword scanning
    object_type = "HazardEvent"
    severity = "LOW"
    for keyword, sev in _KEYWORD_TO_SEVERITY.items():
        if keyword in text:
            severity = sev
            if keyword in ("conflict", "battle", "bombing", "protest", "riot"):
                object_type = "ArmedConflict"
            break

    title = (
        raw_event.get("title")
        or raw_event.get("name")
        or raw_event.get("event_type", "Unknown Event")
    )

    return {
        "object_type": object_type,
        "severity": severity,
        "confidence": 0.3,  # low confidence for rule-based
        "title": str(title),
        "summary": f"Rule-based classification: {object_type} ({severity})",
        "actors": [],
        "properties": raw_event,
    }


# ── Public API ────────────────────────────────────────────────────────


def classify_event(
    raw_event: dict[str, Any],
    llm: LLMClient | None = None,
) -> dict[str, Any]:
    """Classify a single raw event using LLM (with rule-based fallback)."""
    if llm is None:
        llm = LLMClient()

    prompt = CLASSIFICATION_PROMPT_TEMPLATE.format(
        item=json.dumps(raw_event, default=str),
        schemas=_SCHEMA_REF,
    )

    result = llm.extract_json(prompt, system=CLASSIFICATION_SYSTEM_PROMPT)
    if result is None:
        return _rule_based_classify(raw_event)

    # Validate required fields
    for key in ("object_type", "severity", "confidence"):
        if key not in result:
            logger.warning("LLM classification missing '%s', falling back", key)
            return _rule_based_classify(raw_event)

    return result


def classify_events(
    events: list[dict[str, Any]],
    llm: LLMClient | None = None,
    max_batch: int = 10,
) -> list[dict[str, Any]]:
    """Classify multiple events (processes up to *max_batch* at a time)."""
    if llm is None:
        llm = LLMClient()

    results: list[dict[str, Any]] = []
    for i in range(0, len(events), max_batch):
        batch = events[i : i + max_batch]
        for event in batch:
            results.append(classify_event(event, llm))
    return results
