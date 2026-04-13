"""
Pattern detection algorithms for the Global Stability Engine.
Identifies cross-domain operations, geographic clustering, temporal acceleration,
domain spillover, and network correlations.
"""

import math
import logging
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass
from collections import Counter

from .engine import GSEEvent, CATEGORY_WEIGHTS

logger = logging.getLogger(__name__)


@dataclass
class PatternMatch:
    """A detected pattern."""
    pattern_type: str
    description: str
    severity: str
    region_id: str
    categories: list[str]
    event_ids: list[str]
    confidence: float
    detected_at: datetime


class PatternDetector:
    """Detects complex patterns across events."""

    def __init__(self):
        pass

    def detect_all(self, events: list[GSEEvent], region_id: str | None = None) -> list[PatternMatch]:
        """Run all pattern detectors and return matches."""
        patterns: list[PatternMatch] = []
        patterns.extend(self.cross_domain_operations(events, region_id))
        patterns.extend(self.geographic_clustering(events))
        patterns.extend(self.temporal_acceleration(events, region_id))
        patterns.extend(self.domain_spillover(events, region_id))
        return patterns

    def cross_domain_operations(
        self, events: list[GSEEvent], region_id: str | None = None
    ) -> list[PatternMatch]:
        """Detect activities spanning >=5 active categories in the same region."""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=24)
        recent = [e for e in events if e.timestamp >= cutoff]

        if region_id:
            recent = [e for e in recent if e.region_id == region_id]

        # Group by region
        by_region: dict[str, list[GSEEvent]] = {}
        for e in recent:
            by_region.setdefault(e.region_id, []).append(e)

        patterns = []
        for rid, region_events in by_region.items():
            categories = set(e.category for e in region_events)
            if len(categories) >= 5:
                patterns.append(PatternMatch(
                    pattern_type="cross_domain_operation",
                    description=f"Multi-domain activity detected in region {rid}: "
                                f"{len(categories)} active categories ({', '.join(sorted(categories))})",
                    severity="HIGH",
                    region_id=rid,
                    categories=sorted(categories),
                    event_ids=[e.event_id for e in region_events],
                    confidence=min(1.0, len(categories) / 8.0),
                    detected_at=now,
                ))
        return patterns

    def geographic_clustering(self, events: list[GSEEvent]) -> list[PatternMatch]:
        """
        DBSCAN-style clustering of events to identify hotspot formation.
        Uses simplified distance-based clustering.
        """
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=24)
        recent = [e for e in events if e.timestamp >= cutoff and e.latitude and e.longitude]

        if len(recent) < 3:
            return []

        # Simple grid-based clustering (0.5 degree cells ≈ 55km)
        CELL_SIZE = 0.5
        cells: dict[tuple[int, int], list[GSEEvent]] = {}
        for e in recent:
            cell = (int(e.latitude / CELL_SIZE), int(e.longitude / CELL_SIZE))
            cells.setdefault(cell, []).append(e)

        patterns = []
        for cell, cell_events in cells.items():
            if len(cell_events) >= 5:
                center_lat = (cell[0] + 0.5) * CELL_SIZE
                center_lng = (cell[1] + 0.5) * CELL_SIZE
                categories = set(e.category for e in cell_events)
                regions = set(e.region_id for e in cell_events)
                patterns.append(PatternMatch(
                    pattern_type="geographic_cluster",
                    description=f"Hotspot formation detected at ({center_lat:.1f}, {center_lng:.1f}): "
                                f"{len(cell_events)} events across {len(categories)} categories",
                    severity="MODERATE" if len(cell_events) < 10 else "HIGH",
                    region_id=list(regions)[0] if regions else "",
                    categories=sorted(categories),
                    event_ids=[e.event_id for e in cell_events[:20]],
                    confidence=min(1.0, len(cell_events) / 15.0),
                    detected_at=now,
                ))
        return patterns

    def temporal_acceleration(
        self, events: list[GSEEvent], region_id: str | None = None
    ) -> list[PatternMatch]:
        """Compare event frequency to 7-day baseline, flag if >60% increase."""
        now = datetime.now(timezone.utc)
        last_24h = [e for e in events if e.timestamp >= now - timedelta(hours=24)]
        last_7d = [e for e in events if e.timestamp >= now - timedelta(days=7)]

        if region_id:
            last_24h = [e for e in last_24h if e.region_id == region_id]
            last_7d = [e for e in last_7d if e.region_id == region_id]

        # Compare 24h rate to 7-day average daily rate
        daily_baseline = len(last_7d) / 7.0
        current_rate = len(last_24h)

        patterns = []
        if daily_baseline == 0 and current_rate > 0:
            # New activity in a previously quiet region — infinite acceleration
            patterns.append(PatternMatch(
                pattern_type="temporal_acceleration",
                description=f"New activity spike: {current_rate:.0f} events in last 24h "
                            f"with zero prior baseline over 7 days",
                severity="HIGH",
                region_id=region_id or "GLOBAL",
                categories=sorted(set(e.category for e in last_24h)),
                event_ids=[e.event_id for e in last_24h[:20]],
                confidence=min(1.0, current_rate / 10.0),
                detected_at=now,
            ))
        elif daily_baseline > 0 and current_rate > daily_baseline * 1.6:
            increase_pct = ((current_rate - daily_baseline) / daily_baseline) * 100
            patterns.append(PatternMatch(
                pattern_type="temporal_acceleration",
                description=f"Event frequency up {increase_pct:.0f}% vs 7-day baseline "
                            f"({current_rate:.0f} today vs {daily_baseline:.1f}/day average)",
                severity="HIGH" if increase_pct > 100 else "MODERATE",
                region_id=region_id or "GLOBAL",
                categories=sorted(set(e.category for e in last_24h)),
                event_ids=[e.event_id for e in last_24h[:20]],
                confidence=min(1.0, increase_pct / 200.0),
                detected_at=now,
            ))
        return patterns

    def domain_spillover(
        self, events: list[GSEEvent], region_id: str | None = None
    ) -> list[PatternMatch]:
        """
        Track cascade patterns (e.g., political → conflict → humanitarian).
        Detect when activity spreads from one domain to adjacent domains over time.
        """
        SPILLOVER_CHAINS = [
            ["political", "conflict", "migration"],
            ["economic", "political", "conflict"],
            ["natural_disaster", "migration", "health"],
            ["energy", "economic", "political"],
            ["cyber", "economic", "political"],
        ]

        now = datetime.now(timezone.utc)
        filtered = events
        if region_id:
            filtered = [e for e in events if e.region_id == region_id]

        # Check 72-hour windows for chain progression
        patterns = []
        for chain in SPILLOVER_CHAINS:
            chain_detected = True
            for i, category in enumerate(chain):
                window_start = now - timedelta(hours=72 - i * 24)
                window_end = now - timedelta(hours=48 - i * 24) if i < len(chain) - 1 else now
                cat_events = [
                    e for e in filtered
                    if e.category == category and window_start <= e.timestamp <= window_end
                ]
                if not cat_events:
                    chain_detected = False
                    break

            if chain_detected:
                patterns.append(PatternMatch(
                    pattern_type="domain_spillover",
                    description=f"Cascade pattern detected: {' → '.join(chain)}",
                    severity="HIGH",
                    region_id=region_id or "GLOBAL",
                    categories=chain,
                    event_ids=[],
                    confidence=0.7,
                    detected_at=now,
                ))
        return patterns
