"""AI-powered event classification for incoming data.

Uses LLM to classify raw events into ontology object types, extract
structured fields, assess severity, and generate summaries.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from .llm_client import LLMClient

logger = logging.getLogger(__name__)

VALID_SEVERITIES = frozenset({"LOW", "MODERATE", "HIGH", "CRITICAL"})

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


def _base_properties(raw_event: dict[str, Any]) -> dict[str, Any]:
    """Return the best available property payload from a raw event."""
    nested_properties = raw_event.get("properties")
    if isinstance(nested_properties, dict) and nested_properties:
        return dict(nested_properties)
    return dict(raw_event)


def _coerce_confidence(value: Any) -> float | None:
    """Coerce an arbitrary confidence value to a 0-1 float."""
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return None
    return max(0.0, min(1.0, confidence))


def _normalise_classification(
    raw_event: dict[str, Any],
    result: dict[str, Any],
) -> dict[str, Any] | None:
    """Validate and normalise an LLM classification response."""
    object_type = str(result.get("object_type", "")).strip()
    if object_type not in ODL_OBJECT_TYPES:
        logger.warning("LLM returned unknown object_type %r", object_type)
        return None

    severity = str(result.get("severity", "")).upper().strip()
    if severity not in VALID_SEVERITIES:
        logger.warning("LLM returned invalid severity %r", result.get("severity"))
        return None

    confidence = _coerce_confidence(result.get("confidence"))
    if confidence is None:
        logger.warning("LLM returned invalid confidence %r", result.get("confidence"))
        return None

    llm_properties = result.get("properties", {})
    if llm_properties is None:
        llm_properties = {}
    if not isinstance(llm_properties, dict):
        logger.warning("LLM returned non-dict properties for classification")
        return None

    properties = {
        **_base_properties(raw_event),
        **llm_properties,
    }
    title = str(
        result.get("title")
        or properties.get("title")
        or raw_event.get("title")
        or raw_event.get("name")
        or "Unknown Event"
    )
    summary = str(
        result.get("summary")
        or properties.get("description")
        or raw_event.get("summary")
        or ""
    )
    actors = result.get("actors", [])
    if not isinstance(actors, list):
        actors = [actors]

    properties.setdefault("title", title)
    properties.setdefault("severity", severity)
    properties.setdefault("description", summary)
    if raw_event.get("source") and "source" not in properties:
        properties["source"] = raw_event["source"]

    return {
        "object_type": object_type,
        "severity": severity,
        "confidence": confidence,
        "title": title,
        "summary": summary,
        "actors": [str(actor) for actor in actors if actor is not None],
        "properties": properties,
    }


# ── Public API ────────────────────────────────────────────────────────


def classify_event(
    raw_event: dict[str, Any],
    llm: LLMClient | None = None,
) -> dict[str, Any]:
    """Classify a single raw event using the LLM with rule-based fallback."""
    if llm is None:
        llm = LLMClient()

    prompt = CLASSIFICATION_PROMPT_TEMPLATE.format(
        item=json.dumps(raw_event, default=str),
        schemas=_SCHEMA_REF,
    )

    result = llm.extract_json(prompt, system=CLASSIFICATION_SYSTEM_PROMPT)
    if result is None or not isinstance(result, dict):
        logger.info("Falling back to rule-based classification for event")
        return _rule_based_classify(raw_event)

    normalised = _normalise_classification(raw_event, result)
    if normalised is None:
        logger.info("Using rule-based classification because LLM output was invalid")
        return _rule_based_classify(raw_event)

    logger.debug(
        "Classified event as %s with %s severity",
        normalised["object_type"],
        normalised["severity"],
    )
    return normalised


def classify_events(
    events: list[dict[str, Any]],
    llm: LLMClient | None = None,
    max_batch: int = 10,
) -> list[dict[str, Any]]:
    """Classify multiple events, processing up to ``max_batch`` items at a time."""
    if llm is None:
        llm = LLMClient()

    results: list[dict[str, Any]] = []
    for i in range(0, len(events), max_batch):
        batch = events[i : i + max_batch]
        for event in batch:
            results.append(classify_event(event, llm))
    return results
