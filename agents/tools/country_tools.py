"""
Country intelligence tools — composite country profiles and scoring.
Uses REST Countries API for country metadata instead of hardcoded data.
"""

import os
import logging
from functools import lru_cache

import httpx

from gse.scoring import GSEScorer

logger = logging.getLogger(__name__)

FOUNDRY_API_URL = os.getenv("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_TOKEN = os.getenv("FOUNDRY_TOKEN") or os.getenv("FOUNDRY_API_TOKEN", "")
REST_COUNTRIES_URL = os.getenv("REST_COUNTRIES_URL", "https://restcountries.com/v3.1")


def _foundry_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {FOUNDRY_TOKEN}"} if FOUNDRY_TOKEN else {}


# Region mapping from UN regions to our GSE region IDs
_REGION_MAP: dict[str, str] = {
    "Europe": "europe",
    "Asia": "east-asia",
    "Africa": "africa",
    "Americas": "north-america",
    "Oceania": "oceania",
    "Middle East": "middle-east",
    "South-Eastern Asia": "south-asia",
    "Southern Asia": "south-asia",
    "Eastern Asia": "east-asia",
    "Western Asia": "middle-east",
    "Northern America": "north-america",
    "Southern America": "south-america",
    "Northern Africa": "africa",
    "Sub-Saharan Africa": "africa",
    "Australia and New Zealand": "oceania",
    "Melanesia": "oceania",
    "Micronesia": "oceania",
    "Polynesia": "oceania",
    "Central Asia": "south-asia",
    "Central America": "north-america",
    "Caribbean": "north-america",
}

# Manual overrides for countries whose UN region mapping is ambiguous
_COUNTRY_REGION_OVERRIDES: dict[str, str] = {
    "IR": "middle-east",  # Iran
    "IL": "middle-east",  # Israel
    "LB": "middle-east",  # Lebanon
    "SY": "middle-east",  # Syria
    "IQ": "middle-east",  # Iraq
    "YE": "middle-east",  # Yemen
    "JO": "middle-east",  # Jordan
    "PS": "middle-east",  # Palestine
    "KW": "middle-east",  # Kuwait
    "AE": "middle-east",  # UAE
    "QA": "middle-east",  # Qatar
    "BH": "middle-east",  # Bahrain
    "OM": "middle-east",  # Oman
    "SA": "middle-east",  # Saudi Arabia
    "EG": "middle-east",  # Egypt
    "TR": "middle-east",  # Turkey
    "UA": "europe",       # Ukraine
    "RU": "europe",       # Russia
}

# In-memory cache of country metadata
_country_cache: dict[str, dict] | None = None


async def _load_all_countries() -> dict[str, dict]:
    """Fetch all countries from REST Countries API and build lookup."""
    global _country_cache
    if _country_cache is not None:
        return _country_cache

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{REST_COUNTRIES_URL}/all?fields=cca2,name,region,subregion,latlng,area,population")
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("Failed to fetch countries from REST Countries API: %s", e)
        _country_cache = {}
        return _country_cache

    result: dict[str, dict] = {}
    for country in data:
        code = country.get("cca2", "")
        if not code:
            continue
        region = country.get("region", "")
        subregion = country.get("subregion", "")
        coords = country.get("latlng", [0, 0])
        # latlng is [lat, lng] in REST Countries, we need [lng, lat]
        mapped_region = _COUNTRY_REGION_OVERRIDES.get(code) or _REGION_MAP.get(region) or _REGION_MAP.get(subregion) or region.lower().replace(" ", "-")
        result[code] = {
            "name": country.get("name", {}).get("common", code),
            "region": mapped_region,
            "coords": [coords[1] if len(coords) > 1 else 0, coords[0] if len(coords) > 0 else 0],
            "area": country.get("area"),
            "population": country.get("population"),
        }

    _country_cache = result
    logger.info("Loaded %d countries from REST Countries API", len(result))
    return result


async def _get_country(code: str) -> dict | None:
    """Get country metadata by ISO code."""
    countries = await _load_all_countries()
    return countries.get(code.upper())


async def get_country_intelligence(country_code: str) -> dict:
    """
    Get comprehensive intelligence profile for a country.
    Returns composite risk score across 12 categories.
    """
    country = await _get_country(country_code)
    if not country:
        return {"error": f"Unknown country code: {country_code}"}

    scorer = GSEScorer()
    region_id = country["region"]

    # Compute GSE for the country's region
    gse_result = await scorer.compute_region(region_id)
    patterns = await scorer.detect_patterns(region_id)
    history = scorer.generate_gse_history(region_id, days=30)

    # Build category breakdown for radar chart
    categories = {}
    for factor in gse_result.contributing_factors:
        categories[factor.category] = {
            "pressure": round(factor.pressure, 3),
            "weight": factor.weight,
            "eventCount": factor.event_count,
            "score": round(factor.pressure * factor.weight * 100, 1),
        }

    # Fill missing categories with zero
    all_categories = [
        "conflict", "terrorism", "natural_disaster", "cyber", "political",
        "health", "economic", "energy", "migration", "environmental", "space", "technology",
    ]
    for cat in all_categories:
        if cat not in categories:
            categories[cat] = {"pressure": 0, "weight": 0, "eventCount": 0, "score": 0}

    # Fetch financial indicators for the country
    financial = await _fetch_financial(country_code)

    # Fetch active events
    events = await _fetch_events_for_country(country_code)

    return {
        "countryCode": country_code.upper(),
        "countryName": country["name"],
        "regionId": region_id,
        "coordinates": country["coords"],
        "gseScore": gse_result.gse_score,
        "threatLevel": gse_result.threat_level.value,
        "escalationAlert": gse_result.escalation_alert,
        "eventCount": gse_result.event_count,
        "categories": categories,
        "gseHistory": history,
        "patterns": [
            {
                "type": p.pattern_type,
                "description": p.description,
                "severity": p.severity,
                "confidence": p.confidence,
            }
            for p in patterns
        ],
        "financialIndicators": financial,
        "activeEvents": events,
    }


async def get_country_list() -> list[dict]:
    """Get list of all tracked countries with summary data."""
    countries = await _load_all_countries()
    if not countries:
        return []

    scorer = GSEScorer()
    all_results = await scorer.compute_all_regions()
    result_map = {r.region_id: r for r in all_results}

    country_list = []
    for code, data in countries.items():
        gse = result_map.get(data["region"])
        country_list.append({
            "countryCode": code,
            "countryName": data["name"],
            "regionId": data["region"],
            "gseScore": gse.gse_score if gse else 0,
            "threatLevel": gse.threat_level.value if gse else "STABLE",
            "eventCount": gse.event_count if gse else 0,
            "population": data.get("population"),
        })
    country_list.sort(key=lambda c: c["gseScore"], reverse=True)
    return country_list


async def _fetch_financial(country_code: str) -> list[dict]:
    """Fetch financial indicators for a country from Foundry."""
    headers = _foundry_headers()
    try:
        async with httpx.AsyncClient(timeout=15.0, base_url=FOUNDRY_API_URL) as client:
            resp = await client.get(
                "/objects",
                params={"objectType": "FinancialIndicator", "pageSize": 50},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            return [
                obj.get("properties", obj)
                for obj in data
                if obj.get("properties", obj).get("region") == country_code
                or obj.get("properties", obj).get("countryCode") == country_code
            ]
    except Exception:
        return []


async def _fetch_events_for_country(country_code: str) -> list[dict]:
    """Fetch active events for a country from Foundry."""
    headers = _foundry_headers()
    try:
        async with httpx.AsyncClient(timeout=15.0, base_url=FOUNDRY_API_URL) as client:
            resp = await client.get(
                "/objects",
                params={"objectType": "HazardEvent", "pageSize": 20},
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json().get("data", [])[:10]
    except Exception:
        return []
