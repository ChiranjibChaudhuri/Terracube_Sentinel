from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import httpx

from config import AgentConfig, FoundryConfig, OllamaConfig
from tools.ontology_tools import query_objects, traverse_graph

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are the Reporting Agent for TerraCube Sentinel. Your role is to generate "
    "situation reports, daily briefings, and executive summaries of the Earth Observation "
    "landscape. Compile data from across the ontology into clear, structured reports "
    "with sections for hazards, risks, sensor status, and infrastructure health. "
    "Use professional language suitable for decision-makers."
)


class ReportingAgent:
    """Generates situation reports and briefings from ontology data."""

    def __init__(
        self,
        agent_config: AgentConfig | None = None,
        ollama_config: OllamaConfig | None = None,
        foundry_config: FoundryConfig | None = None,
    ) -> None:
        self.agent_config = agent_config or AgentConfig(
            tools=["query_objects", "traverse_graph"]
        )
        self.ollama_config = ollama_config or OllamaConfig()
        self.foundry_config = foundry_config or FoundryConfig()
        self.system_prompt = SYSTEM_PROMPT
        self.tools: list[str] = self.agent_config.tools

    async def run(self, message: str, context: dict) -> str:
        """Generate a situation report based on current ontology state."""

        # 1. Collect data from all key object types
        report_data: dict[str, list[dict]] = {}
        object_types = [
            "HazardEvent",
            "RiskAssessment",
            "Alert",
            "Sensor",
            "InfrastructureAsset",
            "Region",
        ]

        for obj_type in object_types:
            try:
                results = await query_objects(
                    object_type=obj_type,
                    foundry_config=self.foundry_config,
                )
                report_data[obj_type] = results
            except Exception:
                logger.warning("Failed to query %s for report", obj_type)
                report_data[obj_type] = []

        # 2. Traverse links for active hazards to get affected regions
        affected_regions: list[dict] = []
        hazard_events = report_data.get("HazardEvent", [])
        for event in hazard_events[:5]:
            event_id = event.get("id") or event.get("objectId")
            if event_id:
                try:
                    links = await traverse_graph(
                        object_id=str(event_id),
                        link_type="affectsRegion",
                        foundry_config=self.foundry_config,
                    )
                    affected_regions.extend(links)
                except Exception:
                    logger.warning(
                        "Failed to traverse region links for %s", event_id
                    )

        # 3. Build the prompt with collected data
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        data_section = f"## Report Timestamp\n{now}\n\n"

        for obj_type, objects in report_data.items():
            data_section += f"## {obj_type} ({len(objects)} total)\n"
            data_section += json.dumps(objects[:5], indent=2, default=str)
            data_section += "\n\n"

        if affected_regions:
            data_section += (
                f"## Affected Regions ({len(affected_regions)} links)\n"
            )
            data_section += json.dumps(
                affected_regions[:10], indent=2, default=str
            )
            data_section += "\n\n"

        prompt = (
            f"{data_section}"
            f"## Report Request\n{message}\n\n"
            "Generate a structured situation report with the following sections: "
            "Executive Summary, Active Hazards, Risk Overview, Sensor Status, "
            "Infrastructure Health, and Recommendations."
        )

        # 4. Call Ollama
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    f"{self.ollama_config.base_url}/api/generate",
                    json={
                        "model": self.ollama_config.model,
                        "system": self.system_prompt,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": self.agent_config.temperature,
                            "num_predict": self.agent_config.max_tokens,
                        },
                    },
                )
                resp.raise_for_status()
                return resp.json().get("response", "No response from LLM.")
        except httpx.HTTPError:
            logger.exception("Ollama request failed")
            # Fallback: return a basic summary
            lines = [
                f"Situation Report - {now}",
                f"  Hazard Events: {len(report_data.get('HazardEvent', []))}",
                f"  Risk Assessments: {len(report_data.get('RiskAssessment', []))}",
                f"  Active Alerts: {len(report_data.get('Alert', []))}",
                f"  Sensors: {len(report_data.get('Sensor', []))}",
                f"  Infrastructure Assets: {len(report_data.get('InfrastructureAsset', []))}",
                f"  Regions: {len(report_data.get('Region', []))}",
            ]
            return "\n".join(lines)
