"""Research Agent — web search and data enrichment."""

from __future__ import annotations

import httpx
from ..config import FoundryConfig

SYSTEM_PROMPT = (
    "You are the Research Agent for TerraCube Sentinel. "
    "Your role is to search for external context on events, "
    "fact-check social media reports against sensor data, "
    "find historical precedents, and enrich ontology data with "
    "scientific literature and news sources."
)

config = FoundryConfig()


async def web_search(query: str) -> list[dict]:
    """Stub for web search — returns empty results until a search API is configured."""
    return [{"query": query, "results": [], "note": "Web search not yet configured"}]


class ResearchAgent:
    system_prompt = SYSTEM_PROMPT
    tools = ["query_objects", "web_search"]

    async def run(self, message: str, context: dict) -> str:
        search_results = await web_search(message)
        headers = {"Authorization": f"Bearer {config.token}"}

        try:
            async with httpx.AsyncClient(timeout=30, base_url=config.api_url) as client:
                resp = await client.get(
                    "/objects",
                    params={"objectType": "DataSource"},
                    headers=headers,
                )
                resp.raise_for_status()
                sources = resp.json().get("data", [])

                return (
                    f"Research results for: '{message}'\n\n"
                    f"ONTOLOGY SOURCES: {len(sources)} data sources available\n"
                    f"WEB SEARCH: {len(search_results[0].get('results', []))} results "
                    f"(web search API not yet configured)\n\n"
                    f"Recommendation: Configure a search API key to enable "
                    f"external research enrichment."
                )
        except httpx.HTTPError:
            return f"Research query for '{message}' — ontology API unavailable."
