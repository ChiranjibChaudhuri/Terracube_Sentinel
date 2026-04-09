"""Entity extraction from unstructured text (news, reports, social media).

Extracts people, organisations, locations, dates, event types,
casualties / damage numbers and maps them to ODL ontology objects.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from .llm_client import LLMClient
from .config import LLMSettings

logger = logging.getLogger(__name__)

# ── Simple gazetteer for geo-parsing (major cities / countries) ───────

GAZETTEER: dict[str, tuple[float, float]] = {
    # Cities
    "new york": (40.7128, -74.0060),
    "london": (51.5074, -0.1278),
    "tokyo": (35.6762, 139.6503),
    "paris": (48.8566, 2.3522),
    "beijing": (39.9042, 116.4074),
    "moscow": (55.7558, 37.6173),
    "cairo": (30.0444, 31.2357),
    "mumbai": (19.0760, 72.8777),
    "são paulo": (-23.5505, -46.6333),
    "lagos": (6.5244, 3.3792),
    "istanbul": (41.0082, 28.9784),
    "jakarta": (-6.2088, 106.8456),
    "nairobi": (-1.2921, 36.8219),
    "baghdad": (33.3152, 44.3661),
    "kabul": (34.5553, 69.2075),
    "kyiv": (50.4501, 30.5234),
    "damascus": (33.5138, 36.2765),
    "tehran": (35.6892, 51.3890),
    "riyadh": (24.7136, 46.6753),
    "singapore": (1.3521, 103.8198),
    "sydney": (-33.8688, 151.2093),
    "berlin": (52.5200, 13.4050),
    "rome": (41.9028, 12.4964),
    "madrid": (40.4168, -3.7038),
    "washington": (38.9072, -77.0369),
    "los angeles": (34.0522, -118.2437),
    "mexico city": (19.4326, -99.1332),
    "buenos aires": (-34.6037, -58.3816),
    "manila": (14.5995, 120.9842),
    "karachi": (24.8607, 67.0011),
    "dhaka": (23.8103, 90.4125),
    "bangkok": (13.7563, 100.5018),
    "taipei": (25.0330, 121.5654),
    "seoul": (37.5665, 126.9780),
    "hanoi": (21.0285, 105.8542),
    # Countries (centroids)
    "ukraine": (48.3794, 31.1656),
    "russia": (61.5240, 105.3188),
    "china": (35.8617, 104.1954),
    "india": (20.5937, 78.9629),
    "brazil": (-14.2350, -51.9253),
    "nigeria": (9.0820, 8.6753),
    "iran": (32.4279, 53.6880),
    "iraq": (33.2232, 43.6793),
    "syria": (34.8021, 38.9968),
    "afghanistan": (33.9391, 67.7100),
    "somalia": (5.1521, 46.1996),
    "yemen": (15.5527, 48.5164),
    "libya": (26.3351, 17.2283),
    "sudan": (12.8628, 30.2176),
    "myanmar": (21.9162, 95.9560),
    "ethiopia": (9.1450, 40.4897),
    "pakistan": (30.3753, 69.3451),
    "turkey": (38.9637, 35.2433),
    "indonesia": (-0.7893, 113.9213),
    "philippines": (12.8797, 121.7740),
    "japan": (36.2048, 138.2529),
    "united states": (37.0902, -95.7129),
    "united kingdom": (55.3781, -3.4360),
    "germany": (51.1657, 10.4515),
    "france": (46.2276, 2.2137),
    "australia": (-25.2744, 133.7751),
    "mexico": (23.6345, -102.5528),
}

EXTRACTION_SYSTEM_PROMPT = """You are an entity extraction engine for the TerraCube Sentinel OSINT platform.
Given text (news article, report, social media post), extract all relevant entities.

Respond ONLY with a JSON object:
{
  "people": [{"name": "...", "role": "..."}],
  "organizations": [{"name": "...", "type": "..."}],
  "locations": [{"name": "...", "lat": null, "lng": null}],
  "dates": ["YYYY-MM-DD"],
  "event_types": ["EARTHQUAKE", "FLOOD", ...],
  "casualties": {"dead": 0, "injured": 0, "displaced": 0},
  "damage": {"description": "...", "estimate_usd": null},
  "summary": "One-sentence summary of the text"
}

If a field is unknown, use null or empty list. For locations, attempt to provide
lat/lng if the location is a well-known city or country."""


def _geo_lookup(location_name: str) -> tuple[float, float] | None:
    """Look up coordinates for a location using the built-in gazetteer."""
    key = location_name.strip().lower()
    if key in GAZETTEER:
        return GAZETTEER[key]
    # Partial match
    for gaz_key, coords in GAZETTEER.items():
        if gaz_key in key or key in gaz_key:
            return coords
    return None


def _enrich_locations(entities: dict[str, Any]) -> dict[str, Any]:
    """Fill in missing lat/lng from gazetteer."""
    for loc in entities.get("locations", []):
        if loc.get("lat") is None or loc.get("lng") is None:
            coords = _geo_lookup(loc.get("name", ""))
            if coords:
                loc["lat"], loc["lng"] = coords
    return entities


def _map_to_ontology_objects(entities: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert extracted entities into ODL-ready object dicts."""
    objects: list[dict[str, Any]] = []

    for loc in entities.get("locations", []):
        geometry = {}
        if loc.get("lat") is not None and loc.get("lng") is not None:
            geometry = {
                "type": "Point",
                "coordinates": [loc["lng"], loc["lat"]],
            }
        for event_type in entities.get("event_types", ["UNKNOWN"]):
            objects.append({
                "object_type": "HazardEvent",
                "properties": {
                    "eventType": event_type,
                    "title": entities.get("summary", ""),
                    "geometry": geometry,
                    "casualties": entities.get("casualties", {}),
                    "damage": entities.get("damage", {}),
                },
                "links": {
                    "actors": [
                        p.get("name") for p in entities.get("people", [])
                    ],
                    "organizations": [
                        o.get("name") for o in entities.get("organizations", [])
                    ],
                },
            })

    # If no locations found, still emit one object
    if not entities.get("locations"):
        for event_type in entities.get("event_types", ["UNKNOWN"]):
            objects.append({
                "object_type": "HazardEvent",
                "properties": {
                    "eventType": event_type,
                    "title": entities.get("summary", ""),
                    "casualties": entities.get("casualties", {}),
                    "damage": entities.get("damage", {}),
                },
                "links": {},
            })

    return objects


# ── Public API ────────────────────────────────────────────────────────


def extract_entities(
    text: str,
    region_context: dict[str, Any] | None = None,
    llm: LLMClient | None = None,
) -> list[dict[str, Any]]:
    """Extract entities from free text and map to ontology objects.

    Parameters
    ----------
    text:
        Raw text (news article, social media post, report body).
    region_context:
        Optional dict with ``region_id`` and ``region_name`` to bias the
        extraction toward a known region.
    llm:
        Pre-initialised LLM client (one is created if *None*).

    Returns
    -------
    list[dict]
        List of ``{object_type, properties, links}`` dicts ready for
        Open Foundry ingestion.
    """
    if not text or not text.strip():
        return []

    if llm is None:
        llm = LLMClient()

    prompt = f"Extract entities from the following text:\n\n{text}"
    if region_context:
        prompt += f"\n\nRegion context: {json.dumps(region_context, default=str)}"

    raw_result = llm.extract_json(prompt, system=EXTRACTION_SYSTEM_PROMPT)
    if raw_result is None or not isinstance(raw_result, dict):
        # LLM returned nothing, a list, or unparseable text — use regex fallback
        if isinstance(raw_result, list):
            logger.warning("LLM returned a list instead of dict; falling back to regex")
        entities = _regex_extract(text)
    else:
        entities = raw_result
        # Ensure required keys exist even if LLM omitted them
        entities.setdefault("people", [])
        entities.setdefault("organizations", [])
        entities.setdefault("locations", [])
        entities.setdefault("dates", [])
        entities.setdefault("event_types", [])
        entities.setdefault("casualties", {})
        entities.setdefault("damage", {})
        entities.setdefault("summary", text[:200])

    entities = _enrich_locations(entities)
    return _map_to_ontology_objects(entities)


def extract_from_gdelt(
    article: dict[str, Any],
    llm: LLMClient | None = None,
) -> dict[str, Any]:
    """Specialised extraction for GDELT article format."""
    title = article.get("title", "")
    url = article.get("url", "")
    domain = article.get("domain", "")

    text = f"Title: {title}\nSource: {domain}\nURL: {url}"

    objects = extract_entities(text, llm=llm)
    return {
        "source": "gdelt",
        "source_url": url,
        "objects": objects,
    }


def extract_from_news(
    text: str,
    source_url: str = "",
    llm: LLMClient | None = None,
) -> dict[str, Any]:
    """General news article extraction."""
    objects = extract_entities(text, llm=llm)
    return {
        "source": "news",
        "source_url": source_url,
        "objects": objects,
    }


# ── Regex fallback ────────────────────────────────────────────────────

_NUMBER_RE = re.compile(r"(\d[\d,]*)\s*(dead|killed|injured|wounded|displaced)", re.I)
_DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")


def _regex_extract(text: str) -> dict[str, Any]:
    """Lightweight regex-based entity extraction (no LLM needed)."""
    casualties: dict[str, int] = {"dead": 0, "injured": 0, "displaced": 0}
    for match in _NUMBER_RE.finditer(text):
        num = int(match.group(1).replace(",", ""))
        label = match.group(2).lower()
        if label in ("dead", "killed"):
            casualties["dead"] += num
        elif label in ("injured", "wounded"):
            casualties["injured"] += num
        elif label == "displaced":
            casualties["displaced"] += num

    dates = _DATE_RE.findall(text)

    # Location extraction via gazetteer scan
    locations: list[dict[str, Any]] = []
    text_lower = text.lower()
    for name, (lat, lng) in GAZETTEER.items():
        if name in text_lower:
            locations.append({"name": name.title(), "lat": lat, "lng": lng})

    return {
        "people": [],
        "organizations": [],
        "locations": locations[:5],  # cap to avoid noise
        "dates": dates[:5],
        "event_types": [],
        "casualties": casualties,
        "damage": {},
        "summary": text[:200] if text else "",
    }
