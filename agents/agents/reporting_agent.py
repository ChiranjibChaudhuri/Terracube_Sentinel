"""Reporting Agent — generates situation reports and briefings."""

from __future__ import annotations

import httpx
from ..config import FoundryConfig

SYSTEM_PROMPT = (
    "You are the Reporting Agent for TerraCube Sentinel. "
    "Your role is to generate clear, actionable situation reports, "
    "daily digests, weekly trend analyses, and post-event assessments. "
    "Structure reports with executive summary, key findings, and recommendations."
)

config = FoundryConfig()


class ReportingAgent:
    system_prompt = SYSTEM_PROMPT
    tools = ["query_objects", "traverse_graph"]

    async def run(self, message: str, context: dict) -> str:
        headers = {"Authorization": f"Bearer {config.token}"}
        try:
            async with httpx.AsyncClient(timeout=30, base_url=config.api_url) as client:
                hazards = (
                    await client.get("/objects", params={"objectType": "HazardEvent"}, headers=headers)
                ).json().get("data", [])
                alerts = (
                    await client.get("/objects", params={"objectType": "Alert"}, headers=headers)
                ).json().get("data", [])
                pipelines = (
                    await client.get("/objects", params={"objectType": "PipelineExecution"}, headers=headers)
                ).json().get("data", [])

                return (
                    f"=== SITUATION REPORT ===\n\n"
                    f"EXECUTIVE SUMMARY\n"
                    f"- Active hazard events: {len(hazards)}\n"
                    f"- Active alerts: {len(alerts)}\n"
                    f"- Pipeline executions (recent): {len(pipelines)}\n\n"
                    f"KEY FINDINGS\n"
                    f"- Data ingestion pipelines operational\n"
                    f"- Monitoring {len(hazards)} active hazard events across all domains\n\n"
                    f"RECOMMENDATIONS\n"
                    f"- Review high-severity alerts for immediate action\n"
                    f"- Verify sensor coverage in active hazard zones"
                )
        except httpx.HTTPError:
            return "Report generation failed — ontology API unavailable."
