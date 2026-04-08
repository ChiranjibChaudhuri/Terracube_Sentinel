"""Ontology tools — query, get, and traverse the knowledge graph."""

from __future__ import annotations

import httpx
from ..config import FoundryConfig

config = FoundryConfig()


async def query_objects(
    object_type: str,
    filters: dict | None = None,
) -> list[dict]:
    """Query objects from the Open Foundry ontology.

    GET {api_url}/objects?objectType={object_type}
    """
    headers = {"Authorization": f"Bearer {config.token}"}
    params: dict[str, str] = {"objectType": object_type}
    if filters:
        for k, v in filters.items():
            params[k] = str(v)

    async with httpx.AsyncClient(timeout=30, base_url=config.api_url) as client:
        resp = await client.get("/objects", params=params, headers=headers)
        resp.raise_for_status()
        return resp.json().get("data", [])


async def get_object(object_type: str, object_id: str) -> dict:
    """Get a single object by ID.

    GET {api_url}/objects/{object_id}
    """
    headers = {"Authorization": f"Bearer {config.token}"}
    async with httpx.AsyncClient(timeout=30, base_url=config.api_url) as client:
        resp = await client.get(f"/objects/{object_id}", headers=headers)
        resp.raise_for_status()
        return resp.json()


async def traverse_graph(
    object_id: str,
    link_type: str,
    direction: str = "OUTBOUND",
) -> list[dict]:
    """Traverse links from an object.

    GET {api_url}/links?from={object_id}&linkType={link_type}
    """
    headers = {"Authorization": f"Bearer {config.token}"}
    params = {
        "from" if direction == "OUTBOUND" else "to": object_id,
        "linkType": link_type,
    }
    async with httpx.AsyncClient(timeout=30, base_url=config.api_url) as client:
        resp = await client.get("/links", params=params, headers=headers)
        resp.raise_for_status()
        return resp.json().get("data", [])
