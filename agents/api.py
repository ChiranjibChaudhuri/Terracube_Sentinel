from __future__ import annotations

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from orchestrator import AgentOrchestrator

app = FastAPI(
    title="TerraCube Sentinel Agents",
    description="AI-powered Earth Observation & OSINT analysis agents",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = AgentOrchestrator()

# ── Lazy singletons (avoid import-time side effects) ─────────────────

_gse_scorer = None
_briefing_gen = None
_alert_engine = None


def _get_scorer():
    global _gse_scorer
    if _gse_scorer is None:
        from gse.scoring import GSEScorer
        _gse_scorer = GSEScorer()
    return _gse_scorer


def _get_briefing():
    global _briefing_gen
    if _briefing_gen is None:
        from briefing.generator import BriefingGenerator
        _briefing_gen = BriefingGenerator()
    return _briefing_gen


def _get_alert_engine():
    global _alert_engine
    if _alert_engine is None:
        from alerting.engine import AlertEngine
        _alert_engine = AlertEngine()
    return _alert_engine


# ── Models ────────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    message: str
    context: dict | None = None


class ChatResponse(BaseModel):
    response: str
    agent: str
    tools_used: list[str]


class HealthResponse(BaseModel):
    status: str
    agents: list[str]
    version: str = "0.2.0"


# ── Chat ──────────────────────────────────────────────────────────────


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    result = await orchestrator.route(
        message=request.message,
        context=request.context or {},
    )
    return ChatResponse(
        response=result["response"],
        agent=result["agent"],
        tools_used=result["tools_used"],
    )


# ── Health ────────────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        agents=list(orchestrator.agents.keys()),
    )


# ── GSE Endpoints ────────────────────────────────────────────────────


@app.get("/gse/regions")
async def gse_regions():
    """Get GSE scores for all regions."""
    scorer = _get_scorer()
    results = await scorer.compute_all_regions()
    return [
        {
            "regionId": r.region_id,
            "gseScore": r.gse_score,
            "threatLevel": r.threat_level.value,
            "eventCount": r.event_count,
            "escalationAlert": r.escalation_alert,
            "contributingFactors": scorer.get_contributing_factors(r),
        }
        for r in results
    ]


@app.get("/gse/region/{region_id}")
async def gse_region(region_id: str):
    """Get GSE score for a specific region."""
    scorer = _get_scorer()
    result = await scorer.compute_region(region_id)
    return {
        "regionId": result.region_id,
        "gseScore": result.gse_score,
        "threatLevel": result.threat_level.value,
        "eventCount": result.event_count,
        "escalationAlert": result.escalation_alert,
        "contributingFactors": scorer.get_contributing_factors(result),
        "history": scorer.generate_gse_history(region_id),
    }


@app.get("/gse/patterns")
async def gse_patterns(region_id: str | None = None):
    """Detect patterns across events."""
    scorer = _get_scorer()
    patterns = await scorer.detect_patterns(region_id)
    return [
        {
            "type": p.pattern_type,
            "description": p.description,
            "severity": p.severity,
            "regionId": p.region_id,
            "categories": p.categories,
            "confidence": p.confidence,
        }
        for p in patterns
    ]


# ── Briefing Endpoints ───────────────────────────────────────────────


@app.get("/briefing/daily")
async def daily_briefing():
    """Generate daily intelligence briefing."""
    gen = _get_briefing()
    briefing = await gen.generate_daily_briefing()
    return briefing.to_dict()


@app.get("/briefing/sitrep/{region_id}")
async def sitrep(region_id: str, time_window: str = "24h"):
    """Generate situation report for a region."""
    gen = _get_briefing()
    briefing = await gen.generate_sitrep(region_id, time_window)
    return briefing.to_dict()


@app.get("/briefing/threat/{region_id}")
async def threat_advisory(region_id: str):
    """Generate threat advisory for a region."""
    gen = _get_briefing()
    briefing = await gen.generate_threat_advisory(region_id)
    return briefing.to_dict()


@app.get("/briefing/daily/markdown")
async def daily_briefing_markdown():
    """Generate daily briefing as Markdown."""
    from briefing.formatter import BriefingFormatter
    gen = _get_briefing()
    briefing = await gen.generate_daily_briefing()
    return {"markdown": BriefingFormatter.format_markdown(briefing)}


@app.get("/briefing/daily/html")
async def daily_briefing_html():
    """Generate daily briefing as HTML."""
    from briefing.formatter import BriefingFormatter
    from fastapi.responses import HTMLResponse
    gen = _get_briefing()
    briefing = await gen.generate_daily_briefing()
    return HTMLResponse(content=BriefingFormatter.format_html(briefing))


# ── Country Intelligence Endpoints ───────────────────────────────────


@app.get("/country/{country_code}")
async def country_intelligence(country_code: str):
    """Get comprehensive intelligence profile for a country."""
    from tools.country_tools import get_country_intelligence
    return await get_country_intelligence(country_code)


@app.get("/countries")
async def country_list():
    """Get list of all tracked countries with summary data."""
    from tools.country_tools import get_country_list
    return await get_country_list()


# ── Situational Awareness Endpoint ───────────────────────────────────


@app.get("/fusion/awareness")
async def situational_awareness(
    min_lat: float | None = None,
    min_lng: float | None = None,
    max_lat: float | None = None,
    max_lng: float | None = None,
    entity_types: str | None = None,
):
    """Get unified GeoJSON FeatureCollection of all entity types."""
    from tools.fusion_tools import get_situational_awareness
    bbox = None
    if min_lat is not None and min_lng is not None and max_lat is not None and max_lng is not None:
        bbox = (min_lat, min_lng, max_lat, max_lng)
    types = entity_types.split(",") if entity_types else None
    return await get_situational_awareness(bbox=bbox, entity_types=types)


# ── Alert Endpoints ──────────────────────────────────────────────────


@app.get("/alerts/pending")
async def pending_alerts():
    """Get pending (unacknowledged) alerts."""
    engine = _get_alert_engine()
    return engine.get_pending()


@app.get("/alerts/history")
async def alert_history(limit: int = 50):
    """Get alert history."""
    engine = _get_alert_engine()
    return engine.get_history(limit)


@app.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Acknowledge an alert."""
    engine = _get_alert_engine()
    acked = engine.acknowledge(alert_id)
    return {"acknowledged": acked, "alertId": alert_id}


# ── WebSocket for real-time alerts ───────────────────────────────────


@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """WebSocket endpoint for real-time alert push."""
    await websocket.accept()
    engine = _get_alert_engine()
    engine.ws_channel.register(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        engine.ws_channel.unregister(websocket)
