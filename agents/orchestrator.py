from __future__ import annotations

import logging
from typing import Any

from agents.hazard_sentinel import HazardSentinelAgent
from agents.predictive_analyst import PredictiveAnalystAgent
from agents.pattern_discovery import PatternDiscoveryAgent
from agents.automated_action import AutomatedActionAgent
from agents.reporting_agent import ReportingAgent
from agents.research_agent import ResearchAgent

logger = logging.getLogger(__name__)

# Keyword groups mapped to agent names
_INTENT_KEYWORDS: list[tuple[list[str], str]] = [
    (["hazard", "earthquake", "fire", "flood", "storm"], "hazard_sentinel"),
    (["risk", "predict", "forecast"], "predictive_analyst"),
    (["pattern", "correlat", "anomal"], "pattern_discovery"),
    (["execute", "action", "alert", "issue"], "automated_action"),
    (["report", "summary", "brief"], "reporting"),
    (["search", "research", "news"], "research"),
]


class AgentOrchestrator:
    """Routes incoming messages to the most appropriate agent based on keyword intent detection."""

    def __init__(self) -> None:
        self.agents: dict[str, Any] = {
            "hazard_sentinel": HazardSentinelAgent(),
            "predictive_analyst": PredictiveAnalystAgent(),
            "pattern_discovery": PatternDiscoveryAgent(),
            "automated_action": AutomatedActionAgent(),
            "reporting": ReportingAgent(),
            "research": ResearchAgent(),
        }

    def _detect_intent(self, message: str) -> str:
        """Return the agent name whose keywords best match the message.

        The message is compared in lower-case against each keyword group.
        The first group that contains a matching substring wins.  If no
        group matches the message falls through to the default agent.
        """
        lower = message.lower()
        for keywords, agent_name in _INTENT_KEYWORDS:
            for kw in keywords:
                if kw in lower:
                    return agent_name
        return "hazard_sentinel"

    async def route(self, message: str, context: dict) -> dict:
        """Route *message* to the right agent and return a structured result.

        Returns a dict with keys ``response``, ``agent``, and ``tools_used``.
        """
        agent_name = self._detect_intent(message)
        agent = self.agents[agent_name]
        logger.info("Routing to agent=%s for message=%r", agent_name, message[:80])

        try:
            response = await agent.run(message=message, context=context)
        except Exception:
            logger.exception("Agent %s failed", agent_name)
            response = (
                f"Agent '{agent_name}' encountered an error while processing your request."
            )

        return {
            "response": response,
            "agent": agent_name,
            "tools_used": list(agent.tools),
        }
