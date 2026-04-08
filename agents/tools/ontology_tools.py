from __future__ import annotations

import logging

import httpx

from config import FoundryConfig

logger = logging.getLogger(__name__)


async def query_objects(
    object_type: str,
    filters: dict | None = None,
    foundry_config: FoundryConfig | None = None,
) -> list[dict]:
    """Query objects from the Open Foundry ontology.

    Args:
        object_type: The ontology object type to query (e.g. ``HazardEvent``).
        filters: Optional key-value filters to narrow results.
        foundry_config: Optional Foundry connection configuration.

    Returns:
        A list of object dicts returned by the API.
    """
    config = foundry_config or FoundryConfig()
    headers: dict[str, str] = {"Accept": "application/json"}
    if config.token:
        headers["Authorization"] = f"Bearer {config.token}"

    params: dict[str, str] = {"objectType": object_type}
    if filters:
        for key, value in filters.items():
            params[key] = str(value)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{config.api_url}/objects",
            headers=headers,
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

    # The API may wrap results in a top-level key
    if isinstance(data, dict):
        return data.get("data", data.get("objects", [data]))
    return data


async def get_object(
    object_type: str,
    object_id: str,
    foundry_config: FoundryConfig | None = None,
) -> dict:
    """Retrieve a single object by its ID from the ontology.

    Args:
        object_type: The ontology object type.
        object_id: The unique identifier of the object.
        foundry_config: Optional Foundry connection configuration.

    Returns:
        The object dict.
    """
    config = foundry_config or FoundryConfig()
    headers: dict[str, str] = {"Accept": "application/json"}
    if config.token:
        headers["Authorization"] = f"Bearer {config.token}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{config.api_url}/objects/{object_id}",
            headers=headers,
            params={"objectType": object_type},
        )
        resp.raise_for_status()
        return resp.json()


async def traverse_graph(
    object_id: str,
    link_type: str,
    direction: str = "OUTBOUND",
    foundry_config: FoundryConfig | None = None,
) -> list[dict]:
    """Traverse graph links from a given object.

    Args:
        object_id: The source object ID.
        link_type: The link type to follow (e.g. ``affects``).
        direction: Link direction, either ``OUTBOUND`` or ``INBOUND``.
        foundry_config: Optional Foundry connection configuration.

    Returns:
        A list of linked object dicts.
    """
    config = foundry_config or FoundryConfig()
    headers: dict[str, str] = {"Accept": "application/json"}
    if config.token:
        headers["Authorization"] = f"Bearer {config.token}"

    params: dict[str, str] = {
        "from": object_id,
        "linkType": link_type,
        "direction": direction,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{config.api_url}/links",
            headers=headers,
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

    if isinstance(data, dict):
        return data.get("data", data.get("links", []))
    return data
