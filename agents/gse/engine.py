"""
Core GSE computation engine.
GSE = Σ(Regional_Pressure(category) × Category_Weight × Recency_Factor × Confidence_Score)
"""

import math
import logging
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field

from agents.gse.threat_levels import ThreatLevel, get_threat_level, ESCALATION_THRESHOLD

logger = logging.getLogger(__name__)

# Category weights — domain-specific criticality multipliers
CATEGORY_WEIGHTS: dict[str, float] = {
    "conflict": 1.0,
    "terrorism": 0.9,
    "natural_disaster": 0.8,
    "cyber": 0.7,
    "political": 0.6,
    "health": 0.6,
    "economic": 0.5,
    "energy": 0.5,
    "migration": 0.4,
    "environmental": 0.4,
    "space": 0.3,
    "technology": 0.2,
}

# Severity multipliers
SEVERITY_MULTIPLIERS: dict[str, float] = {
    "CRITICAL": 1.0,
    "HIGH": 0.7,
    "MODERATE": 0.4,
    "LOW": 0.1,
}


@dataclass
class GSEEvent:
    """An event contributing to GSE computation."""
    event_id: str
    category: str
    severity: str
    confidence: float
    timestamp: datetime
    region_id: str
    source: str = ""
    latitude: float = 0.0
    longitude: float = 0.0


@dataclass
class RegionalPressure:
    """Computed pressure for a single category in a region."""
    category: str
    event_count: int
    weighted_severity: float
    pressure: float
    weight: float


@dataclass
class GSEResult:
    """Result of GSE computation for a region."""
    region_id: str
    gse_score: float
    threat_level: ThreatLevel
    contributing_factors: list[RegionalPressure]
    event_count: int
    escalation_alert: bool = False
    previous_score: float | None = None
    computed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class GlobalStabilityEngine:
    """
    Multi-factor stability engine computing GSE scores per region.

    GSE = Σ(Regional_Pressure × Category_Weight × Recency_Factor × Confidence_Score)
    """

    def __init__(self, recency_half_life_hours: float = 24.0):
        self.recency_half_life = recency_half_life_hours
        self._history: dict[str, list[tuple[datetime, float]]] = {}

    def compute_gse(
        self,
        region_id: str,
        events: list[GSEEvent],
        time_window_hours: float = 24.0,
    ) -> GSEResult:
        """
        Compute GSE score for a region based on recent events.
        """
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=time_window_hours)

        # Filter events for this region within time window
        region_events = [
            e for e in events
            if e.region_id == region_id and e.timestamp >= cutoff
        ]

        # Group by category
        by_category: dict[str, list[GSEEvent]] = {}
        for event in region_events:
            by_category.setdefault(event.category, []).append(event)

        # Compute per-category pressure
        factors: list[RegionalPressure] = []
        total_gse = 0.0

        for category, cat_events in by_category.items():
            weight = CATEGORY_WEIGHTS.get(category, 0.3)
            pressure = 0.0

            for event in cat_events:
                severity_mult = SEVERITY_MULTIPLIERS.get(event.severity, 0.1)
                recency = self._recency_factor(event.timestamp, now)
                confidence = max(0.0, min(1.0, event.confidence))

                pressure += severity_mult * recency * confidence

            weighted_pressure = pressure * weight
            total_gse += weighted_pressure

            factors.append(RegionalPressure(
                category=category,
                event_count=len(cat_events),
                weighted_severity=sum(
                    SEVERITY_MULTIPLIERS.get(e.severity, 0.1) for e in cat_events
                ) / max(len(cat_events), 1),
                pressure=pressure,
                weight=weight,
            ))

        # Normalize to 0-200 range (can exceed 100 in extreme conditions)
        gse_score = min(200.0, total_gse * 10)

        # Check for escalation
        escalation = False
        prev_score = None
        if region_id in self._history and self._history[region_id]:
            recent = [
                (t, s) for t, s in self._history[region_id]
                if t >= now - timedelta(hours=1)
            ]
            if recent:
                prev_score = recent[0][1]
                if gse_score - prev_score > ESCALATION_THRESHOLD:
                    escalation = True

        # Record history
        self._history.setdefault(region_id, []).append((now, gse_score))
        # Keep last 720 entries (~30 days at hourly)
        self._history[region_id] = self._history[region_id][-720:]

        # Sort factors by pressure descending
        factors.sort(key=lambda f: f.pressure * f.weight, reverse=True)

        return GSEResult(
            region_id=region_id,
            gse_score=round(gse_score, 2),
            threat_level=get_threat_level(gse_score),
            contributing_factors=factors,
            event_count=len(region_events),
            escalation_alert=escalation,
            previous_score=prev_score,
            computed_at=now,
        )

    def _recency_factor(self, event_time: datetime, now: datetime) -> float:
        """Exponential time-decay with configurable half-life."""
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)
        age_hours = (now - event_time).total_seconds() / 3600.0
        if age_hours <= 0:
            return 1.0
        return math.exp(-0.693 * age_hours / self.recency_half_life)

    def get_history(self, region_id: str, days: int = 30) -> list[dict]:
        """Get GSE score history for a region."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        entries = self._history.get(region_id, [])
        return [
            {"timestamp": t.isoformat(), "gse_score": s}
            for t, s in entries if t >= cutoff
        ]
