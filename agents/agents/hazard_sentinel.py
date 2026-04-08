from __future__ import annotations

import json
import logging

import httpx

from config import AgentConfig, FoundryConfig, OllamaConfig
from tools.ontology_tools import query_objects
from tools.weather_tools import get_forecast

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are the Hazard Sentinel Agent for TerraCube Sentinel, a Palantir Foundry "
    "alternative for Earth Observation. Your role is to monitor and analyse natural "
    "hazard events such as earthquakes, floods, wildfires, and storms. You have access "
    "to the ontology of HazardEvent objects and weather forecasts. Summarise active "
    "threats clearly and concisely, including severity, affected regions, and recommended "
    "actions."
)


class HazardSentinelAgent:
    """Monitors active hazard events and summarises current threats."""

    def __init__(
        self,
        agent_config: AgentConfig | None = None,
        ollama_config: OllamaConfig | None = None,
        foundry_config: FoundryConfig | None = None,
    ) -> None:
        self.agent_config = agent_config or AgentConfig(
            tools=["query_objects", "get_forecast"]
        )
        self.ollama_config = ollama_config or OllamaConfig()
        self.foundry_config = foundry_config or FoundryConfig()
        self.system_prompt = SYSTEM_PROMPT
        self.tools: list[str] = self.agent_config.tools

    async def run(self, message: str, context: dict) -> str:
        """Analyse the current hazard landscape and respond to the user query."""

        # 1. Gather active hazard events from the ontology
        hazard_events: list[dict] = []
        try:
            hazard_events = await query_objects(
                object_type="HazardEvent",
                filters={"status": "active"},
                foundry_config=self.foundry_config,
            )
        except Exception:
            logger.warning("Failed to fetch hazard events from ontology")

        # 2. If coordinates are provided in context, pull a weather forecast
        forecast: dict | None = None
        lat = context.get("latitude")
        lon = context.get("longitude")
        if lat is not None and lon is not None:
            try:
                forecast = await get_forecast(
                    latitude=float(lat),
                    longitude=float(lon),
                )
            except Exception:
                logger.warning("Failed to fetch weather forecast")

        # 3. Build the LLM prompt with gathered data
        data_section = "## Active Hazard Events\n"
        if hazard_events:
            data_section += json.dumps(hazard_events, indent=2, default=str)
        else:
            data_section += "No active hazard events found in the ontology.\n"

        if forecast:
            data_section += "\n\n## Weather Forecast\n"
            data_section += json.dumps(forecast, indent=2, default=str)

        prompt = f"{data_section}\n\n## User Query\n{message}"

        # 4. Call Ollama for LLM completion
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
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
            # Fallback: return a structured summary without LLM
            summary_parts = [
                f"Hazard Sentinel found {len(hazard_events)} active event(s)."
            ]
            if forecast:
                summary_parts.append(
                    "Weather forecast data is available for the specified region."
                )
            return " ".join(summary_parts)
