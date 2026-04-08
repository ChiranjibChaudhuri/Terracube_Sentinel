"""
Briefing generation engine.
Produces structured intelligence briefings from GSE data, events, and patterns.
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field

import httpx

from agents.gse.scoring import GSEScorer
from agents.gse.threat_levels import ThreatLevel, get_threat_level, get_threat_description

logger = logging.getLogger(__name__)

FOUNDRY_API_URL = os.getenv("FOUNDRY_API_URL", "http://localhost:8080/api/v1")
FOUNDRY_TOKEN = os.getenv("FOUNDRY_TOKEN", "")


@dataclass
class BriefingSection:
    title: str
    content: str
    priority: int = 0


@dataclass
class Briefing:
    """Structured intelligence briefing."""
    title: str
    briefing_type: str  # sitrep, daily, threat_advisory
    generated_at: datetime
    classification: str = "UNCLASSIFIED"
    sections: list[BriefingSection] = field(default_factory=list)
    region_id: str | None = None
    time_window: str = "24h"

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "briefingType": self.briefing_type,
            "generatedAt": self.generated_at.isoformat(),
            "classification": self.classification,
            "regionId": self.region_id,
            "timeWindow": self.time_window,
            "sections": [
                {"title": s.title, "content": s.content, "priority": s.priority}
                for s in self.sections
            ],
        }


class BriefingGenerator:
    """Generates intelligence briefings from platform data."""

    def __init__(self):
        self.scorer = GSEScorer()

    async def generate_sitrep(self, region_id: str, time_window: str = "24h") -> Briefing:
        """Generate a Situation Report for a specific region."""
        now = datetime.now(timezone.utc)
        gse_result = await self.scorer.compute_region(region_id)
        patterns = await self.scorer.detect_patterns(region_id)
        factors = self.scorer.get_contributing_factors(gse_result)

        briefing = Briefing(
            title=f"SITREP — {region_id.upper()} — {now.strftime('%d %b %Y %H:%M')} UTC",
            briefing_type="sitrep",
            generated_at=now,
            region_id=region_id,
            time_window=time_window,
        )

        # 1. Executive Summary
        threat_desc = get_threat_description(gse_result.threat_level)
        trend = "RISING" if gse_result.escalation_alert else "STABLE"
        briefing.sections.append(BriefingSection(
            title="1. EXECUTIVE SUMMARY",
            content=(
                f"- Region **{region_id}** threat level: **{gse_result.threat_level.value}** "
                f"(GSE: {gse_result.gse_score:.1f})\n"
                f"- {threat_desc}\n"
                f"- Trend: {trend} | Events in window: {gse_result.event_count}\n"
                f"- {len(patterns)} pattern(s) detected"
            ),
            priority=10,
        ))

        # 2. Global State Indicator
        arrow = "↑" if gse_result.escalation_alert else "→" if gse_result.gse_score > 30 else "↓"
        briefing.sections.append(BriefingSection(
            title="2. GLOBAL STATE INDICATOR",
            content=f"**{gse_result.threat_level.value}** {arrow} GSE Score: {gse_result.gse_score:.1f}/200",
            priority=9,
        ))

        # 3. Contributing Factors
        factor_lines = []
        for f in factors[:5]:
            factor_lines.append(
                f"- **{f['category'].title()}**: pressure={f['pressure']:.2f}, "
                f"weight={f['weight']}, events={f['eventCount']}"
            )
        briefing.sections.append(BriefingSection(
            title="3. CONTRIBUTING FACTORS",
            content="\n".join(factor_lines) if factor_lines else "- No significant contributing factors",
            priority=8,
        ))

        # 4. Pattern Detection
        if patterns:
            pattern_lines = [
                f"- **{p.pattern_type}**: {p.description} (confidence: {p.confidence:.0%})"
                for p in patterns
            ]
            briefing.sections.append(BriefingSection(
                title="4. PATTERN DETECTION",
                content="\n".join(pattern_lines),
                priority=7,
            ))

        # 5. Recommended Actions
        actions = self._recommend_actions(gse_result, patterns)
        briefing.sections.append(BriefingSection(
            title="5. RECOMMENDED ACTIONS",
            content="\n".join(f"- {a}" for a in actions),
            priority=6,
        ))

        return briefing

    async def generate_daily_briefing(self) -> Briefing:
        """Generate a daily global intelligence summary."""
        now = datetime.now(timezone.utc)
        all_results = await self.scorer.compute_all_regions()
        all_patterns = await self.scorer.detect_patterns()

        briefing = Briefing(
            title=f"DAILY INTELLIGENCE BRIEFING — {now.strftime('%d %b %Y')}",
            briefing_type="daily",
            generated_at=now,
            time_window="24h",
        )

        # 1. Executive Summary
        critical = [r for r in all_results if r.threat_level == ThreatLevel.CRITICAL]
        heightened = [r for r in all_results if r.threat_level == ThreatLevel.HEIGHTENED]
        total_events = sum(r.event_count for r in all_results)
        max_gse = max((r.gse_score for r in all_results), default=0)
        global_level = get_threat_level(max_gse)

        briefing.sections.append(BriefingSection(
            title="1. EXECUTIVE SUMMARY",
            content=(
                f"- Global threat level: **{global_level.value}** (peak GSE: {max_gse:.1f})\n"
                f"- {len(critical)} CRITICAL region(s), {len(heightened)} HEIGHTENED region(s)\n"
                f"- Total events processed: {total_events}\n"
                f"- Patterns detected: {len(all_patterns)}\n"
                f"- Escalation alerts: {sum(1 for r in all_results if r.escalation_alert)}"
            ),
            priority=10,
        ))

        # 2. Global State Indicator
        arrow = "↑" if any(r.escalation_alert for r in all_results) else "→"
        briefing.sections.append(BriefingSection(
            title="2. GLOBAL STATE INDICATOR",
            content=f"**{global_level.value}** {arrow} Peak GSE: {max_gse:.1f}/200",
            priority=9,
        ))

        # 3. Regional Analysis (top 5 by GSE)
        region_lines = []
        for r in all_results[:5]:
            trend = "↑ ESCALATING" if r.escalation_alert else "→ Stable"
            region_lines.append(
                f"- **{r.region_id}**: {r.threat_level.value} (GSE: {r.gse_score:.1f}) "
                f"— {r.event_count} events — {trend}"
            )
        briefing.sections.append(BriefingSection(
            title="3. REGIONAL ANALYSIS (Top 5)",
            content="\n".join(region_lines) if region_lines else "- No regional data available",
            priority=8,
        ))

        # 4. Active Threats
        threat_lines = []
        for r in critical + heightened:
            top_factor = r.contributing_factors[0] if r.contributing_factors else None
            factor_str = f" — primary driver: {top_factor.category}" if top_factor else ""
            threat_lines.append(
                f"- **{r.region_id}**: {r.threat_level.value} (GSE: {r.gse_score:.1f}){factor_str}"
            )
        briefing.sections.append(BriefingSection(
            title="4. ACTIVE THREATS",
            content="\n".join(threat_lines) if threat_lines else "- No critical threats active",
            priority=7,
        ))

        # 5. Cross-Domain Operations
        cross_domain = [p for p in all_patterns if p.pattern_type == "cross_domain_operation"]
        if cross_domain:
            cd_lines = [f"- {p.description}" for p in cross_domain]
            briefing.sections.append(BriefingSection(
                title="5. CROSS-DOMAIN OPERATIONS",
                content="\n".join(cd_lines),
                priority=6,
            ))

        # 6. Pattern Detection
        if all_patterns:
            pattern_lines = [
                f"- [{p.pattern_type}] {p.description}" for p in all_patterns[:10]
            ]
            briefing.sections.append(BriefingSection(
                title="6. PATTERN DETECTION",
                content="\n".join(pattern_lines),
                priority=5,
            ))

        # 7. Forecast
        briefing.sections.append(BriefingSection(
            title="7. FORECAST (24-48h)",
            content=self._generate_forecast(all_results, all_patterns),
            priority=4,
        ))

        # 8. Recommended Actions
        all_actions = set()
        for r in all_results[:5]:
            patterns_for_region = [p for p in all_patterns if p.region_id == r.region_id]
            all_actions.update(self._recommend_actions(r, patterns_for_region))
        briefing.sections.append(BriefingSection(
            title="8. RECOMMENDED ACTIONS",
            content="\n".join(f"- {a}" for a in sorted(all_actions)),
            priority=3,
        ))

        return briefing

    async def generate_threat_advisory(self, region_id: str) -> Briefing:
        """Generate a threat-specific advisory for a region."""
        now = datetime.now(timezone.utc)
        gse_result = await self.scorer.compute_region(region_id)
        patterns = await self.scorer.detect_patterns(region_id)

        briefing = Briefing(
            title=f"THREAT ADVISORY — {region_id.upper()} — {now.strftime('%d %b %Y %H:%M')} UTC",
            briefing_type="threat_advisory",
            generated_at=now,
            region_id=region_id,
        )

        briefing.sections.append(BriefingSection(
            title="THREAT ASSESSMENT",
            content=(
                f"**Region**: {region_id}\n"
                f"**Threat Level**: {gse_result.threat_level.value}\n"
                f"**GSE Score**: {gse_result.gse_score:.1f}/200\n"
                f"**Escalation**: {'YES — rapid increase detected' if gse_result.escalation_alert else 'No'}\n"
                f"**Active Events**: {gse_result.event_count}"
            ),
            priority=10,
        ))

        actions = self._recommend_actions(gse_result, patterns)
        briefing.sections.append(BriefingSection(
            title="RECOMMENDED ACTIONS",
            content="\n".join(f"- {a}" for a in actions),
            priority=9,
        ))

        return briefing

    @staticmethod
    def _recommend_actions(gse_result, patterns) -> list[str]:
        actions = []
        if gse_result.threat_level == ThreatLevel.CRITICAL:
            actions.append("IMMEDIATE: Activate crisis response protocols")
            actions.append("Increase monitoring frequency to every 5 minutes")
            actions.append("Notify all stakeholders of CRITICAL threat level")
        elif gse_result.threat_level == ThreatLevel.HEIGHTENED:
            actions.append("Increase monitoring frequency to every 15 minutes")
            actions.append("Brief senior leadership on escalation risk")
        elif gse_result.threat_level == ThreatLevel.ELEVATED:
            actions.append("Monitor situation closely for further escalation")

        if gse_result.escalation_alert:
            actions.append("ESCALATION: Review contributing factors for rapid change drivers")

        for p in patterns:
            if p.pattern_type == "cross_domain_operation":
                actions.append(f"Investigate multi-domain activity: {', '.join(p.categories)}")
            elif p.pattern_type == "temporal_acceleration":
                actions.append("Review event acceleration — assess if trend continues")
            elif p.pattern_type == "domain_spillover":
                actions.append(f"Monitor cascade: {' → '.join(p.categories)}")

        if not actions:
            actions.append("Continue routine monitoring")
        return actions

    @staticmethod
    def _generate_forecast(results, patterns) -> str:
        escalating = [r for r in results if r.escalation_alert]
        if escalating:
            regions = ", ".join(r.region_id for r in escalating[:3])
            return (
                f"- **Escalation risk HIGH** in: {regions}\n"
                f"- Continued monitoring recommended for all HEIGHTENED+ regions\n"
                f"- Watch for domain spillover in regions with multi-category activity"
            )
        return (
            "- No immediate escalation expected\n"
            "- Continue standard monitoring cadence\n"
            "- Review long-term trends for slow-burn developments"
        )
