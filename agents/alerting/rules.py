"""
Alert rules — conditions that trigger notifications.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from agents.gse.engine import GSEResult
from agents.gse.patterns import PatternMatch
from agents.gse.threat_levels import ThreatLevel

logger = logging.getLogger(__name__)


class AlertPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class AlertNotification:
    """An alert ready for delivery."""
    alert_id: str
    rule_name: str
    priority: AlertPriority
    title: str
    message: str
    region_id: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict = field(default_factory=dict)
    acknowledged: bool = False


class AlertRule:
    """Base class for alert rules."""

    def __init__(self, name: str, priority: AlertPriority):
        self.name = name
        self.priority = priority

    def evaluate(self, gse_result: GSEResult, patterns: list[PatternMatch]) -> AlertNotification | None:
        raise NotImplementedError


class GSEThresholdRule(AlertRule):
    """Alert when GSE crosses a threshold."""

    def __init__(self, threshold: float, threat_level: ThreatLevel):
        super().__init__(
            name=f"gse_threshold_{threat_level.value.lower()}",
            priority=AlertPriority.CRITICAL if threat_level == ThreatLevel.CRITICAL else AlertPriority.HIGH,
        )
        self.threshold = threshold
        self.threat_level = threat_level

    def evaluate(self, gse_result: GSEResult, patterns: list[PatternMatch]) -> AlertNotification | None:
        if gse_result.gse_score >= self.threshold and gse_result.threat_level == self.threat_level:
            return AlertNotification(
                alert_id=f"gse-{gse_result.region_id}-{self.threat_level.value}-{int(datetime.now(timezone.utc).timestamp())}",
                rule_name=self.name,
                priority=self.priority,
                title=f"GSE {self.threat_level.value}: {gse_result.region_id}",
                message=f"Region {gse_result.region_id} has reached {self.threat_level.value} "
                        f"threat level (GSE: {gse_result.gse_score:.1f})",
                region_id=gse_result.region_id,
                metadata={"gse_score": gse_result.gse_score, "threat_level": self.threat_level.value},
            )
        return None


class EscalationAlertRule(AlertRule):
    """Alert when GSE increases rapidly (>20 points in 1 hour)."""

    def __init__(self):
        super().__init__(name="escalation_alert", priority=AlertPriority.CRITICAL)

    def evaluate(self, gse_result: GSEResult, patterns: list[PatternMatch]) -> AlertNotification | None:
        if gse_result.escalation_alert:
            delta = gse_result.gse_score - (gse_result.previous_score or 0)
            return AlertNotification(
                alert_id=f"escalation-{gse_result.region_id}-{int(datetime.now(timezone.utc).timestamp())}",
                rule_name=self.name,
                priority=AlertPriority.CRITICAL,
                title=f"ESCALATION: {gse_result.region_id}",
                message=f"Rapid GSE increase in {gse_result.region_id}: "
                        f"+{delta:.1f} points in last hour (now: {gse_result.gse_score:.1f})",
                region_id=gse_result.region_id,
                metadata={"delta": delta, "current": gse_result.gse_score, "previous": gse_result.previous_score},
            )
        return None


class CrossDomainRule(AlertRule):
    """Alert when multi-domain operation is detected."""

    def __init__(self):
        super().__init__(name="cross_domain_operation", priority=AlertPriority.HIGH)

    def evaluate(self, gse_result: GSEResult, patterns: list[PatternMatch]) -> AlertNotification | None:
        cross_domain = [p for p in patterns if p.pattern_type == "cross_domain_operation"]
        if cross_domain:
            p = cross_domain[0]
            return AlertNotification(
                alert_id=f"cross-domain-{gse_result.region_id}-{int(datetime.now(timezone.utc).timestamp())}",
                rule_name=self.name,
                priority=AlertPriority.HIGH,
                title=f"Multi-Domain Activity: {p.region_id}",
                message=p.description,
                region_id=p.region_id,
                metadata={"categories": p.categories, "confidence": p.confidence},
            )
        return None


class TemporalAccelerationRule(AlertRule):
    """Alert when event frequency increases >60% vs baseline."""

    def __init__(self):
        super().__init__(name="temporal_acceleration", priority=AlertPriority.HIGH)

    def evaluate(self, gse_result: GSEResult, patterns: list[PatternMatch]) -> AlertNotification | None:
        accel = [p for p in patterns if p.pattern_type == "temporal_acceleration"]
        if accel:
            p = accel[0]
            return AlertNotification(
                alert_id=f"accel-{gse_result.region_id}-{int(datetime.now(timezone.utc).timestamp())}",
                rule_name=self.name,
                priority=AlertPriority.HIGH,
                title=f"Event Acceleration: {p.region_id}",
                message=p.description,
                region_id=p.region_id,
                metadata={"confidence": p.confidence},
            )
        return None


class AlertRuleEngine:
    """Evaluates all alert rules against GSE results and patterns."""

    def __init__(self):
        self.rules: list[AlertRule] = [
            GSEThresholdRule(90, ThreatLevel.CRITICAL),
            GSEThresholdRule(60, ThreatLevel.HEIGHTENED),
            EscalationAlertRule(),
            CrossDomainRule(),
            TemporalAccelerationRule(),
        ]

    def evaluate(self, gse_result: GSEResult, patterns: list[PatternMatch]) -> list[AlertNotification]:
        """Evaluate all rules and return triggered alerts."""
        notifications = []
        for rule in self.rules:
            try:
                notification = rule.evaluate(gse_result, patterns)
                if notification:
                    notifications.append(notification)
            except Exception as e:
                logger.warning("Rule %s failed: %s", rule.name, e)
        return notifications
