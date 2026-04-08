"""Predictive Analyst Agent — risk scores and forecasts."""

from __future__ import annotations

import httpx
from ..config import FoundryConfig

SYSTEM_PROMPT = (
    "You are the Predictive Analyst Agent for TerraCube Sentinel. "
    "Your role is to compute risk scores, analyze weather forecasts, "
    "and predict compound hazard events. Use ensemble model outputs and "
    "historical patterns to provide probabilistic assessments."
)

config = FoundryConfig()


class PredictiveAnalystAgent:
    system_prompt = SYSTEM_PROMPT
    tools = ["query_objects", "get_forecast", "search_stac"]

    async def run(self, message: str, context: dict) -> str:
        headers = {"Authorization": f"Bearer {config.token}"}
        try:
            async with httpx.AsyncClient(timeout=30, base_url=config.api_url) as client:
                resp = await client.get(
                    "/objects",
                    params={"objectType": "RiskAssessment"},
                    headers=headers,
                )
                resp.raise_for_status()
                assessments = resp.json().get("data", [])

                if not assessments:
                    return (
                        "No risk assessments available. Run the risk_scoring pipeline "
                        "to generate composite risk scores for monitored regions."
                    )

                lines = ["Current risk assessments:\n"]
                for ra in assessments[:10]:
                    props = ra.get("properties", ra)
                    lines.append(
                        f"- {props.get('hazardType', '?')}: score {props.get('riskScore', 0)}/100 "
                        f"({props.get('methodology', '?')}, confidence {props.get('confidence', 0):.0%})"
                    )
                return "\n".join(lines)
        except httpx.HTTPError:
            return "Unable to retrieve risk assessments. The Foundry API may be offline."
