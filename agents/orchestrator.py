"""Keyword-based intent router for TerraCube Sentinel agents."""

from __future__ import annotations

from .agents.hazard_sentinel import HazardSentinelAgent
from .agents.predictive_analyst import PredictiveAnalystAgent
from .agents.pattern_discovery import PatternDiscoveryAgent
from .agents.automated_action import AutomatedActionAgent
from .agents.reporting_agent import ReportingAgent
from .agents.research_agent import ResearchAgent

INTENT_MAP: list[tuple[list[str], str]] = [
    (["hazard", "earthquake", "fire", "flood", "storm", "wildfire", "tsunami", "volcano"], "hazard_sentinel"),
    (["risk", "predict", "forecast", "probability", "model"], "predictive_analyst"),
    (["pattern", "correlat", "anomal", "trend", "cluster"], "pattern_discovery"),
    (["execute", "action", "alert", "issue", "trigger", "send"], "automated_action"),
    (["report", "summary", "brief", "situation", "digest"], "reporting"),
    (["search", "research", "news", "article", "web"], "research"),
]


class AgentOrchestrator:
    """Routes messages to the appropriate specialist agent."""

    def __init__(self) -> None:
        self.agents = {
            "hazard_sentinel": HazardSentinelAgent(),
            "predictive_analyst": PredictiveAnalystAgent(),
            "pattern_discovery": PatternDiscoveryAgent(),
            "automated_action": AutomatedActionAgent(),
            "reporting": ReportingAgent(),
            "research": ResearchAgent(),
        }

    def _detect_intent(self, message: str) -> str:
        lower = message.lower()
        for keywords, agent_name in INTENT_MAP:
            if any(kw in lower for kw in keywords):
                return agent_name
        return "hazard_sentinel"

    async def route(self, message: str, context: dict) -> dict:
        agent_name = self._detect_intent(message)
        agent = self.agents[agent_name]
        response = await agent.run(message, context)
        return {
            "response": response,
            "agent": agent_name,
            "tools_used": agent.tools,
        }
