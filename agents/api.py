from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel

from orchestrator import AgentOrchestrator

app = FastAPI(
    title="TerraCube Sentinel Agents",
    description="AI-powered Earth Observation analysis agents",
    version="0.1.0",
)

orchestrator = AgentOrchestrator()


class ChatRequest(BaseModel):
    """Incoming chat request payload."""

    message: str
    context: dict | None = None


class ChatResponse(BaseModel):
    """Chat response returned to the caller."""

    response: str
    agent: str
    tools_used: list[str]


class HealthResponse(BaseModel):
    """Health-check response."""

    status: str
    agents: list[str]


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Route a user message to the appropriate agent and return its response."""
    result = await orchestrator.route(
        message=request.message,
        context=request.context or {},
    )
    return ChatResponse(
        response=result["response"],
        agent=result["agent"],
        tools_used=result["tools_used"],
    )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Return service health and list of registered agents."""
    return HealthResponse(
        status="healthy",
        agents=list(orchestrator.agents.keys()),
    )
