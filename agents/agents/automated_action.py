from __future__ import annotations

import json
import logging

import httpx

from config import AgentConfig, FoundryConfig, OllamaConfig
from tools.ontology_tools import query_objects

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are the Automated Action Agent for TerraCube Sentinel. Your role is to execute "
    "Open Foundry actions such as IssueAlert, CreateRiskAssessment, and other operational "
    "commands. You must validate parameters before execution, explain what action will be "
    "taken, and report the outcome clearly. Always prioritise safety and confirm destructive "
    "actions before proceeding."
)


async def execute_action(
    action_type: str,
    parameters: dict,
    foundry_config: FoundryConfig | None = None,
) -> dict:
    """Execute an action via the Open Foundry actions endpoint.

    Args:
        action_type: The action to execute (e.g. ``IssueAlert``).
        parameters: Action-specific parameters.
        foundry_config: Optional Foundry connection configuration.

    Returns:
        The JSON response from the actions API.
    """
    config = foundry_config or FoundryConfig()
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if config.token:
        headers["Authorization"] = f"Bearer {config.token}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{config.api_url}/actions",
            headers=headers,
            json={
                "actionType": action_type,
                "parameters": parameters,
            },
        )
        resp.raise_for_status()
        return resp.json()


class AutomatedActionAgent:
    """Executes operational actions via the Open Foundry actions API."""

    def __init__(
        self,
        agent_config: AgentConfig | None = None,
        ollama_config: OllamaConfig | None = None,
        foundry_config: FoundryConfig | None = None,
    ) -> None:
        self.agent_config = agent_config or AgentConfig(
            tools=["query_objects", "execute_action"]
        )
        self.ollama_config = ollama_config or OllamaConfig()
        self.foundry_config = foundry_config or FoundryConfig()
        self.system_prompt = SYSTEM_PROMPT
        self.tools: list[str] = self.agent_config.tools

    async def run(self, message: str, context: dict) -> str:
        """Determine and execute the appropriate action for the user request."""

        # 1. Gather context from ontology if needed
        related_objects: list[dict] = []
        object_type = context.get("object_type")
        if object_type:
            try:
                related_objects = await query_objects(
                    object_type=object_type,
                    foundry_config=self.foundry_config,
                )
            except Exception:
                logger.warning("Failed to query objects for context")

        # 2. Build prompt asking the LLM to determine the action
        data_section = ""
        if related_objects:
            data_section = (
                f"## Related {object_type} Objects\n"
                + json.dumps(related_objects[:10], indent=2, default=str)
                + "\n\n"
            )

        available_actions = [
            "IssueAlert",
            "CreateRiskAssessment",
            "UpdateHazardEvent",
            "NotifyStakeholders",
            "TriggerPipeline",
        ]
        data_section += f"## Available Actions\n{json.dumps(available_actions)}\n\n"

        prompt = (
            f"{data_section}"
            f"## User Request\n{message}\n\n"
            "Determine which action to execute and provide the parameters as JSON. "
            "Respond with the action_type and parameters."
        )

        # 3. Ask LLM to determine the action
        action_response: str = ""
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
                action_response = resp.json().get("response", "")
        except httpx.HTTPError:
            logger.exception("Ollama request failed")
            return (
                "Unable to determine the appropriate action. "
                "LLM service is unavailable."
            )

        # 4. Attempt to execute the action if explicitly requested via context
        action_type = context.get("action_type")
        action_params = context.get("action_params", {})
        if action_type:
            try:
                result = await execute_action(
                    action_type=action_type,
                    parameters=action_params,
                    foundry_config=self.foundry_config,
                )
                return (
                    f"Action '{action_type}' executed successfully.\n\n"
                    f"Result: {json.dumps(result, indent=2, default=str)}\n\n"
                    f"Agent analysis: {action_response}"
                )
            except httpx.HTTPError:
                logger.exception("Action execution failed")
                return (
                    f"Action '{action_type}' failed to execute.\n\n"
                    f"Agent analysis: {action_response}"
                )

        return action_response
