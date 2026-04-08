"""Automated Action Agent — executes Open Foundry actions."""

from __future__ import annotations

import httpx
from ..config import FoundryConfig

SYSTEM_PROMPT = (
    "You are the Automated Action Agent for TerraCube Sentinel. "
    "Your role is to execute actions via the Open Foundry Action Framework: "
    "IssueAlert, CreateRiskAssessment, IngestSatelliteData, RunHazardPipeline. "
    "Always verify preconditions before execution and record audit trails."
)

config = FoundryConfig()


class AutomatedActionAgent:
    system_prompt = SYSTEM_PROMPT
    tools = ["query_objects", "execute_action"]

    async def run(self, message: str, context: dict) -> str:
        action_type = context.get("action_type", "IssueAlert")
        params = context.get("action_params", {})
        headers = {
            "Authorization": f"Bearer {config.token}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=30, base_url=config.api_url) as client:
                resp = await client.post(
                    "/actions",
                    json={"actionType": action_type, "parameters": params},
                    headers=headers,
                )
                resp.raise_for_status()
                result = resp.json()
                return (
                    f"Action '{action_type}' executed successfully.\n"
                    f"Result: {result}\n"
                    f"Audit trail recorded."
                )
        except httpx.HTTPError as exc:
            return (
                f"Action '{action_type}' failed: {exc}\n"
                f"Parameters: {params}\n"
                f"Please verify preconditions and retry."
            )
