"""FastAPI application for TerraCube Sentinel AI agents."""

from __future__ import annotations

from pydantic import BaseModel
from fastapi import FastAPI

from .orchestrator import AgentOrchestrator

app = FastAPI(title="TerraCube Sentinel Agents", version="0.1.0")
orchestrator = AgentOrchestrator()


class ChatRequest(BaseModel):
    message: str
    context: dict | None = None


class ChatResponse(BaseModel):
    response: str
    agent: str
    tools_used: list[str]


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    result = await orchestrator.route(req.message, req.context or {})
    return ChatResponse(**result)
