from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class AgentConfig:
    """Configuration for an individual agent."""

    model: str = "llama3"
    temperature: float = 0.7
    max_tokens: int = 2048
    tools: list[str] = field(default_factory=list)


@dataclass
class OllamaConfig:
    """Configuration for the Ollama LLM backend."""

    base_url: str = field(
        default_factory=lambda: os.environ.get(
            "OLLAMA_BASE_URL", "http://localhost:11434"
        )
    )
    model: str = "llama3"


@dataclass
class FoundryConfig:
    """Configuration for the Open Foundry API connection."""

    api_url: str = field(
        default_factory=lambda: os.environ.get(
            "FOUNDRY_API_URL", "http://localhost:8080/api/v1"
        )
    )
    graphql_url: str = field(
        default_factory=lambda: os.environ.get(
            "FOUNDRY_GRAPHQL_URL", "http://localhost:8080/graphql"
        )
    )
    token: str = field(
        default_factory=lambda: os.environ.get("FOUNDRY_TOKEN", "")
    )
