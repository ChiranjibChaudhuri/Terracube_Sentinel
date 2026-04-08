from __future__ import annotations

import json
import logging

import httpx

from config import AgentConfig, FoundryConfig, OllamaConfig
from tools.ontology_tools import query_objects

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are the Research Agent for TerraCube Sentinel. Your role is to enrich "
    "Earth Observation data with external context by searching for relevant news, "
    "scientific publications, and supplementary data sources. Cross-reference "
    "ontology data with external information to provide comprehensive situational "
    "awareness."
)


async def web_search(query: str, max_results: int = 5) -> list[dict]:
    """Search the web for relevant information (stub implementation).

    In production this would integrate with a search API. Currently returns
    a placeholder indicating the feature is pending integration.

    Args:
        query: The search query string.
        max_results: Maximum number of results to return.

    Returns:
        A list of search result dicts with ``title``, ``url``, and ``snippet``.
    """
    # Stub: replace with a real search provider (e.g. SerpAPI, Brave Search)
    return [
        {
            "title": f"Search result for: {query}",
            "url": "https://example.com/search-stub",
            "snippet": (
                "Web search integration is pending. This is a placeholder result. "
                "Configure a search API provider to enable live web search."
            ),
        }
    ]


class ResearchAgent:
    """Enriches ontology data with external web research."""

    def __init__(
        self,
        agent_config: AgentConfig | None = None,
        ollama_config: OllamaConfig | None = None,
        foundry_config: FoundryConfig | None = None,
    ) -> None:
        self.agent_config = agent_config or AgentConfig(
            tools=["query_objects", "web_search"]
        )
        self.ollama_config = ollama_config or OllamaConfig()
        self.foundry_config = foundry_config or FoundryConfig()
        self.system_prompt = SYSTEM_PROMPT
        self.tools: list[str] = self.agent_config.tools

    async def run(self, message: str, context: dict) -> str:
        """Research the topic by combining ontology data with web search."""

        # 1. Query the ontology for related objects
        ontology_results: list[dict] = []
        search_types = ["HazardEvent", "Region", "DataSource"]
        for obj_type in search_types:
            try:
                results = await query_objects(
                    object_type=obj_type,
                    foundry_config=self.foundry_config,
                )
                ontology_results.extend(results[:5])
            except Exception:
                logger.warning("Failed to query %s objects", obj_type)

        # 2. Perform web search
        search_results: list[dict] = []
        try:
            search_results = await web_search(
                query=message,
                max_results=5,
            )
        except Exception:
            logger.warning("Web search failed")

        # 3. Build prompt
        data_section = "## Ontology Data\n"
        if ontology_results:
            data_section += json.dumps(ontology_results[:10], indent=2, default=str)
        else:
            data_section += "No relevant ontology data found.\n"

        data_section += "\n\n## Web Search Results\n"
        if search_results:
            data_section += json.dumps(search_results, indent=2, default=str)
        else:
            data_section += "No web search results available.\n"

        prompt = (
            f"{data_section}\n\n"
            f"## Research Query\n{message}\n\n"
            "Synthesise the available data into a comprehensive research briefing. "
            "Identify key facts, data gaps, and recommended follow-up actions."
        )

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
            return (
                f"Research summary: found {len(ontology_results)} ontology object(s) "
                f"and {len(search_results)} web result(s) for your query."
            )
