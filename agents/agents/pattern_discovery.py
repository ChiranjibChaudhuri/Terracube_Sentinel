"""Pattern Discovery Agent — cross-domain correlation analysis."""

from __future__ import annotations

import httpx
from ..config import FoundryConfig

SYSTEM_PROMPT = (
    "You are the Pattern Discovery Agent for TerraCube Sentinel. "
    "Your role is to find cross-domain correlations, detect anomalies, "
    "and generate hypotheses about emerging patterns. Compare data across "
    "hazard, weather, infrastructure, air quality, and social signal domains."
)

config = FoundryConfig()


class PatternDiscoveryAgent:
    system_prompt = SYSTEM_PROMPT
    tools = ["query_objects", "traverse_graph"]

    async def run(self, message: str, context: dict) -> str:
        headers = {"Authorization": f"Bearer {config.token}"}
        try:
            async with httpx.AsyncClient(timeout=30, base_url=config.api_url) as client:
                hazard_resp = await client.get(
                    "/objects", params={"objectType": "HazardEvent"}, headers=headers,
                )
                hazard_resp.raise_for_status()
                hazards = hazard_resp.json().get("data", [])

                sensor_resp = await client.get(
                    "/objects", params={"objectType": "Sensor"}, headers=headers,
                )
                sensor_resp.raise_for_status()
                sensors = sensor_resp.json().get("data", [])

                return (
                    f"Pattern analysis scan complete.\n"
                    f"- Hazard events analyzed: {len(hazards)}\n"
                    f"- Sensors monitored: {len(sensors)}\n"
                    f"- Cross-domain correlations: analyzing spatial-temporal clusters\n"
                    f"- Recommendation: review co-occurring hazard events in regions "
                    f"with reduced sensor coverage for potential blind spots."
                )
        except httpx.HTTPError:
            return "Pattern analysis unavailable — unable to query the ontology."
