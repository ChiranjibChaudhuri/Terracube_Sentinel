"""Auto-ontology mapping: raw source data → ODL object types.

Uses LLM when available, with deterministic rule-based fallback for
well-known sources (USGS, FIRMS, OpenSky, AIS, etc.).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from .llm_client import LLMClient
from .config import LLMSettings

logger = logging.getLogger(__name__)

# ── In-memory mapping cache (source -> field mapping) ─────────────────
_mapping_cache: dict[str, dict[str, str]] = {}

# ── Rule-based mappings for known sources ─────────────────────────────

RULE_BASED_MAPPINGS: dict[str, dict[str, Any]] = {
    "usgs": {
        "object_type": "HazardEvent",
        "field_map": {
            "mag": "magnitude",
            "place": "title",
            "time": "startTime",
            "type": "eventType",
            "tsunami": "tsunamiWarning",
            "sig": "significance",
        },
        "defaults": {
            "eventType": "EARTHQUAKE",
            "source": "usgs",
        },
    },
    "firms": {
        "object_type": "HazardEvent",
        "field_map": {
            "latitude": "latitude",
            "longitude": "longitude",
            "brightness": "intensity",
            "confidence": "confidence",
            "acq_date": "startTime",
            "frp": "firePower",
        },
        "defaults": {
            "eventType": "WILDFIRE",
            "source": "firms",
        },
    },
    "opensky": {
        "object_type": "Aircraft",
        "field_map": {
            "icao24": "icao24",
            "callsign": "callsign",
            "origin_country": "origin",
            "longitude": "longitude",
            "latitude": "latitude",
            "baro_altitude": "altitude",
            "velocity": "velocity",
            "true_track": "heading",
        },
        "defaults": {
            "source": "opensky",
        },
    },
    "ais": {
        "object_type": "Vessel",
        "field_map": {
            "mmsi": "mmsi",
            "name": "name",
            "ship_type": "vesselType",
            "flag": "flag",
            "lat": "latitude",
            "lon": "longitude",
            "speed": "speed",
            "course": "course",
            "destination": "destination",
        },
        "defaults": {
            "source": "ais",
        },
    },
    "celestrak": {
        "object_type": "SatelliteObject",
        "field_map": {
            "NORAD_CAT_ID": "noradId",
            "OBJECT_NAME": "name",
            "OBJECT_TYPE": "objectType",
            "ORBIT_TYPE": "orbitType",
            "INCLINATION": "inclination",
            "PERIOD": "period",
            "APOGEE": "apogee",
            "PERIGEE": "perigee",
        },
        "defaults": {
            "source": "celestrak",
        },
    },
    "open_meteo": {
        "object_type": "HazardEvent",
        "field_map": {
            "temperature": "temperature",
            "windspeed": "windSpeed",
            "precipitation": "precipitation",
            "weathercode": "weatherCode",
        },
        "defaults": {
            "eventType": "WEATHER",
            "source": "open_meteo",
        },
    },
    "openaq": {
        "object_type": "HazardEvent",
        "field_map": {
            "parameter": "pollutant",
            "value": "concentration",
            "unit": "unit",
            "location": "title",
        },
        "defaults": {
            "eventType": "AIR_QUALITY",
            "source": "openaq",
        },
    },
    "gdelt": {
        "object_type": "SocialSignal",
        "field_map": {
            "title": "title",
            "url": "url",
            "tone_score": "toneScore",
            "sentiment": "sentiment",
            "event_type": "eventType",
            "timestamp": "timestamp",
            "keywords": "keywords",
        },
        "defaults": {
            "source": "gdelt",
        },
    },
}

MAPPING_SYSTEM_PROMPT = """You are a data mapping engine for TerraCube Sentinel.
Given raw data from a source, map its fields to the correct ODL (Open Data Layer) object type.

Valid object types: HazardEvent, ArmedConflict, Aircraft, Vessel, InfrastructureAsset, SatelliteObject, SocialSignal

Respond ONLY with a JSON object:
{
  "object_type": "<type>",
  "properties": {<mapped field names and values>},
  "links": {<relationships to other objects>}
}"""


def _apply_rule_based(raw_data: dict[str, Any], source: str) -> dict[str, Any] | None:
    """Apply a rule-based mapping for a known source."""
    mapping = RULE_BASED_MAPPINGS.get(source)
    if mapping is None:
        return None

    properties: dict[str, Any] = dict(mapping.get("defaults", {}))
    field_map = mapping.get("field_map", {})

    for raw_field, odl_field in field_map.items():
        val = raw_data.get(raw_field)
        if val is not None:
            properties[odl_field] = val

    # Preserve geometry if present
    geometry = raw_data.get("geometry")
    if geometry:
        properties["geometry"] = geometry
    elif "latitude" in properties and "longitude" in properties:
        lat = properties.get("latitude")
        lng = properties.get("longitude")
        if lat is not None and lng is not None:
            properties["geometry"] = {
                "type": "Point",
                "coordinates": [lng, lat],
            }

    # Add quality metadata
    properties["aiProcessedAt"] = datetime.now(timezone.utc).isoformat()
    properties["aiMappingMethod"] = "rule_based"

    return {
        "object_type": mapping["object_type"],
        "properties": properties,
        "links": {},
    }


def map_to_ontology(
    raw_data: dict[str, Any],
    source: str,
    llm: LLMClient | None = None,
) -> dict[str, Any]:
    """Map raw source data to an ODL ontology object.

    Tries LLM mapping first (if available), then falls back to
    rule-based mapping, then returns a best-effort generic mapping.
    """
    # 1. Check in-memory cache for a learned mapping for this source
    cached = _mapping_cache.get(source)
    if cached:
        field_map = cached.get("field_map", {})
        cached_obj_type = cached.get("object_type", "HazardEvent")
        properties = {}
        for raw_field, odl_field in field_map.items():
            val = raw_data.get(raw_field)
            if val is not None:
                properties[odl_field] = val
        if properties:
            properties["aiProcessedAt"] = datetime.now(timezone.utc).isoformat()
            properties["aiMappingMethod"] = "cached"
            return {
                "object_type": cached_obj_type,
                "properties": properties,
                "links": {},
            }

    # 2. Try LLM mapping
    if llm is not None and llm.is_available():
        prompt = (
            f"Map this data from source '{source}' to an ODL object:\n\n"
            f"```json\n{json.dumps(raw_data, default=str)}\n```"
        )
        result = llm.extract_json(prompt, system=MAPPING_SYSTEM_PROMPT)
        if result and "object_type" in result:
            props = result.get("properties", {})
            props["aiProcessedAt"] = datetime.now(timezone.utc).isoformat()
            props["aiMappingMethod"] = "llm"
            result["properties"] = props

            # Learn the mapping for future items from this source
            if isinstance(raw_data, dict) and isinstance(props, dict):
                learned: dict[str, str] = {}
                matched_odl_keys: set[str] = set()
                for raw_key in raw_data:
                    for odl_key in props:
                        if (
                            odl_key not in matched_odl_keys
                            and raw_data[raw_key] is not None
                            and raw_data[raw_key] == props.get(odl_key)
                        ):
                            learned[raw_key] = odl_key
                            matched_odl_keys.add(odl_key)
                            break  # one raw_key maps to one odl_key
                if learned:
                    _mapping_cache[source] = {
                        "field_map": learned,
                        "object_type": result["object_type"],
                    }

            return result

    # 3. Rule-based fallback
    rule_result = _apply_rule_based(raw_data, source)
    if rule_result is not None:
        return rule_result

    # 4. Generic fallback — wrap raw data as-is
    logger.warning("No mapping found for source '%s', using generic wrapper", source)
    return {
        "object_type": "HazardEvent",
        "properties": {
            **raw_data,
            "source": source,
            "aiProcessedAt": datetime.now(timezone.utc).isoformat(),
            "aiMappingMethod": "generic_fallback",
        },
        "links": {},
    }
