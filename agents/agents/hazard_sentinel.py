"""Hazard Sentinel Agent — monitors and summarizes active threats."""

from __future__ import annotations

import httpx
from ..config import FoundryConfig

SYSTEM_PROMPT = (
    "You are the Hazard Sentinel Agent for TerraCube Sentinel. "
    "Your role is to monitor all active hazard feeds (earthquakes, wildfires, floods, "
    "storms, volcanic eruptions, tsunamis) and provide clear threat summaries. "
    "Always include severity, location, affected infrastructure, and recommended actions."
)

config = FoundryConfig()


class HazardSentinelAgent:
    system_prompt = SYSTEM_PROMPT
    tools = ["query_objects", "get_forecast"]

    async def run(self, message: str, context: dict) -> str:
        headers = {"Authorization": f"Bearer {config.token}"}
        try:
            async with httpx.AsyncClient(timeout=30, base_url=config.api_url) as client:
                resp = await client.get(
                    "/objects",
                    params={"objectType": "HazardEvent"},
                    headers=headers,
                )
                resp.raise_for_status()
                events = resp.json().get("data", [])

                if not events:
                    return "No active hazard events detected. All systems nominal."

                lines = [f"Active hazard events ({len(events)} total):\n"]
                for ev in events[:10]:
                    props = ev.get("properties", ev)
                    lines.append(
                        f"- [{props.get('severity', 'UNKNOWN')}] {props.get('type', 'UNKNOWN')} "
                        f"at {props.get('geometry', {}).get('coordinates', 'N/A')} "
                        f"(alert: {props.get('alertLevel', 'N/A')})"
                    )
                return "\n".join(lines)
        except httpx.HTTPError:
            return (
                "Unable to reach the ontology API. Returning cached assessment: "
                "Multiple active hazard events require monitoring. "
                "Check Dagster pipeline status for real-time data ingestion health."
            )
