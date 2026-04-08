from __future__ import annotations

import json
import logging

import httpx

from config import AgentConfig, FoundryConfig, OllamaConfig
from tools.ontology_tools import query_objects, traverse_graph

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are the Pattern Discovery Agent for TerraCube Sentinel. Your role is to find "
    "cross-domain correlations and anomalies across the Earth Observation ontology. "
    "Analyse relationships between Regions, HazardEvents, Sensors, InfrastructureAssets, "
    "and other object types. Identify unusual patterns, temporal correlations, and "
    "spatial clusters that may indicate emerging risks."
)


class PatternDiscoveryAgent:
    """Discovers cross-domain correlations and anomalies in the ontology graph."""

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
        """Search for patterns and correlations across the ontology."""

        # 1. Gather data from multiple object types for cross-domain analysis
        object_types = ["HazardEvent", "Sensor", "InfrastructureAsset", "Region"]
        gathered_data: dict[str, list[dict]] = {}

        for obj_type in object_types:
            try:
                results = await query_objects(
                    object_type=obj_type,
                    foundry_config=self.foundry_config,
                )
                gathered_data[obj_type] = results[:20]
            except Exception:
                logger.warning("Failed to query %s objects", obj_type)
                gathered_data[obj_type] = []

        # 2. Traverse graph links from hazard events if available
        graph_links: list[dict] = []
        hazard_events = gathered_data.get("HazardEvent", [])
        for event in hazard_events[:5]:
            event_id = event.get("id") or event.get("objectId")
            if event_id:
                try:
                    links = await traverse_graph(
                        object_id=str(event_id),
                        link_type="affects",
                        foundry_config=self.foundry_config,
                    )
                    graph_links.extend(links)
                except Exception:
                    logger.warning("Failed to traverse links for %s", event_id)

        # 3. Build the prompt
        data_section = ""
        for obj_type, objects in gathered_data.items():
            data_section += f"## {obj_type} ({len(objects)} objects)\n"
            data_section += json.dumps(objects[:5], indent=2, default=str)
            data_section += "\n\n"

        if graph_links:
            data_section += f"## Graph Links ({len(graph_links)} relationships)\n"
            data_section += json.dumps(graph_links[:10], indent=2, default=str)

        prompt = f"{data_section}\n\n## User Query\n{message}"

        # 4. Call Ollama
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
            total = sum(len(v) for v in gathered_data.values())
            return (
                f"Pattern analysis: scanned {total} objects across "
                f"{len(gathered_data)} types, found {len(graph_links)} "
                f"graph relationship(s)."
            )
