from __future__ import annotations

import json
import logging

import httpx

from config import AgentConfig, FoundryConfig, OllamaConfig
from tools.ontology_tools import query_objects
from tools.weather_tools import get_forecast
from tools.satellite_tools import search_stac

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are the Predictive Analyst Agent for TerraCube Sentinel. Your role is to "
    "assess and predict risk by combining hazard event data, weather forecasts, and "
    "satellite imagery availability. Compute risk scores, identify trends, and provide "
    "actionable predictions. Present results with confidence levels and supporting data."
)


class PredictiveAnalystAgent:
    """Analyses risk by combining ontology data, forecasts, and satellite coverage."""

    def __init__(
        self,
        agent_config: AgentConfig | None = None,
        ollama_config: OllamaConfig | None = None,
        foundry_config: FoundryConfig | None = None,
    ) -> None:
        self.agent_config = agent_config or AgentConfig(
            tools=["query_objects", "get_forecast", "search_stac"]
        )
        self.ollama_config = ollama_config or OllamaConfig()
        self.foundry_config = foundry_config or FoundryConfig()
        self.system_prompt = SYSTEM_PROMPT
        self.tools: list[str] = self.agent_config.tools

    async def run(self, message: str, context: dict) -> str:
        """Generate a risk prediction based on available data sources."""

        # 1. Fetch risk assessments and hazard events
        risk_assessments: list[dict] = []
        hazard_events: list[dict] = []
        try:
            risk_assessments = await query_objects(
                object_type="RiskAssessment",
                foundry_config=self.foundry_config,
            )
        except Exception:
            logger.warning("Failed to fetch risk assessments")

        try:
            hazard_events = await query_objects(
                object_type="HazardEvent",
                filters={"status": "active"},
                foundry_config=self.foundry_config,
            )
        except Exception:
            logger.warning("Failed to fetch hazard events")

        # 2. Get weather forecast if coordinates provided
        forecast: dict | None = None
        lat = context.get("latitude")
        lon = context.get("longitude")
        if lat is not None and lon is not None:
            try:
                forecast = await get_forecast(
                    latitude=float(lat),
                    longitude=float(lon),
                    days=7,
                )
            except Exception:
                logger.warning("Failed to fetch weather forecast")

        # 3. Search for satellite imagery if bounding box provided
        stac_results: list[dict] = []
        bbox = context.get("bbox")
        if bbox:
            try:
                stac_results = await search_stac(
                    bbox=bbox,
                    datetime_range=context.get("datetime_range", ""),
                )
            except Exception:
                logger.warning("Failed to search STAC catalog")

        # 4. Build prompt
        data_section = "## Risk Assessments\n"
        if risk_assessments:
            data_section += json.dumps(risk_assessments[:10], indent=2, default=str)
        else:
            data_section += "None found.\n"

        data_section += "\n\n## Active Hazard Events\n"
        if hazard_events:
            data_section += json.dumps(hazard_events[:10], indent=2, default=str)
        else:
            data_section += "None found.\n"

        if forecast:
            data_section += "\n\n## Weather Forecast (7-day)\n"
            data_section += json.dumps(forecast, indent=2, default=str)

        if stac_results:
            data_section += (
                f"\n\n## Satellite Imagery Available ({len(stac_results)} items)\n"
            )
            data_section += json.dumps(stac_results[:5], indent=2, default=str)

        prompt = f"{data_section}\n\n## User Query\n{message}"

        # 5. Call Ollama
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
            return (
                f"Predictive analysis summary: {len(risk_assessments)} risk assessment(s), "
                f"{len(hazard_events)} active hazard(s), "
                f"{len(stac_results)} satellite image(s) available."
            )
