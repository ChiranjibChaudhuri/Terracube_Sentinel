"""
Country intelligence tools — composite country profiles and scoring.
"""

import os
import logging
from datetime import datetime, timezone

import httpx

from gse.scoring import GSEScorer

logger = logging.getLogger(__name__)

FOUNDRY_API_URL = os.getenv("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_TOKEN = os.getenv("FOUNDRY_TOKEN", "")

# Country metadata for intelligence profiles
COUNTRY_DATA: dict[str, dict] = {
    "US": {"name": "United States", "region": "north-america", "coords": [-98.6, 39.8]},
    "GB": {"name": "United Kingdom", "region": "europe", "coords": [-1.2, 52.2]},
    "JP": {"name": "Japan", "region": "east-asia", "coords": [138.3, 36.2]},
    "DE": {"name": "Germany", "region": "europe", "coords": [10.4, 51.2]},
    "FR": {"name": "France", "region": "europe", "coords": [2.2, 46.2]},
    "IN": {"name": "India", "region": "south-asia", "coords": [78.9, 20.6]},
    "CN": {"name": "China", "region": "east-asia", "coords": [104.2, 35.9]},
    "BR": {"name": "Brazil", "region": "south-america", "coords": [-51.9, -14.2]},
    "AU": {"name": "Australia", "region": "oceania", "coords": [133.8, -25.3]},
    "RU": {"name": "Russia", "region": "europe", "coords": [105.3, 61.5]},
    "ZA": {"name": "South Africa", "region": "africa", "coords": [22.9, -30.6]},
    "NG": {"name": "Nigeria", "region": "africa", "coords": [8.7, 9.1]},
    "EG": {"name": "Egypt", "region": "middle-east", "coords": [30.8, 26.8]},
    "MX": {"name": "Mexico", "region": "north-america", "coords": [-102.6, 23.6]},
    "ID": {"name": "Indonesia", "region": "south-asia", "coords": [113.9, -0.8]},
    "TR": {"name": "Turkey", "region": "middle-east", "coords": [35.2, 38.9]},
    "SA": {"name": "Saudi Arabia", "region": "middle-east", "coords": [45.1, 23.9]},
    "KR": {"name": "South Korea", "region": "east-asia", "coords": [127.8, 35.9]},
    "UA": {"name": "Ukraine", "region": "europe", "coords": [31.2, 48.4]},
    "PK": {"name": "Pakistan", "region": "south-asia", "coords": [69.3, 30.4]},
}


async def get_country_intelligence(country_code: str) -> dict:
    """
    Get comprehensive intelligence profile for a country.
    Returns composite risk score across 12 categories.
    """
    country = COUNTRY_DATA.get(country_code.upper())
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
    scorer = GSEScorer()
    all_results = await scorer.compute_all_regions()
    result_map = {r.region_id: r for r in all_results}

    countries = []
    for code, data in COUNTRY_DATA.items():
        gse = result_map.get(data["region"])
        countries.append({
            "countryCode": code,
            "countryName": data["name"],
            "regionId": data["region"],
            "gseScore": gse.gse_score if gse else 0,
            "threatLevel": gse.threat_level.value if gse else "STABLE",
            "eventCount": gse.event_count if gse else 0,
        })
    countries.sort(key=lambda c: c["gseScore"], reverse=True)
    return countries


async def _fetch_financial(country_code: str) -> list[dict]:
    """Fetch financial indicators for a country."""
    headers = {"Authorization": f"Bearer {FOUNDRY_TOKEN}"}
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
    """Fetch active events for a country."""
    headers = {"Authorization": f"Bearer {FOUNDRY_TOKEN}"}
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
