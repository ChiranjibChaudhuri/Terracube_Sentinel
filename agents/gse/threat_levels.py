"""
5-tier threat level classification for the Global Stability Engine.
"""

from enum import Enum


class ThreatLevel(str, Enum):
    STABLE = "STABLE"
    ELEVATED = "ELEVATED"
    HEIGHTENED = "HEIGHTENED"
    CRITICAL = "CRITICAL"


# Thresholds for threat level transitions
THREAT_THRESHOLDS = {
    ThreatLevel.STABLE: (0, 30),
    ThreatLevel.ELEVATED: (30, 60),
    ThreatLevel.HEIGHTENED: (60, 90),
    ThreatLevel.CRITICAL: (90, float("inf")),
}

# Escalation alert: GSE increased >20 points in last hour
ESCALATION_THRESHOLD = 20.0


def get_threat_level(gse_score: float) -> ThreatLevel:
    """Classify GSE score into a threat level."""
    if gse_score >= 90:
        return ThreatLevel.CRITICAL
    elif gse_score >= 60:
        return ThreatLevel.HEIGHTENED
    elif gse_score >= 30:
        return ThreatLevel.ELEVATED
    return ThreatLevel.STABLE


def get_threat_color(level: ThreatLevel) -> str:
    """Get display color for a threat level."""
    return {
        ThreatLevel.STABLE: "#22c55e",
        ThreatLevel.ELEVATED: "#eab308",
        ThreatLevel.HEIGHTENED: "#f97316",
        ThreatLevel.CRITICAL: "#ef4444",
    }.get(level, "#6b7280")


def get_threat_description(level: ThreatLevel) -> str:
    """Get human-readable description for a threat level."""
    return {
        ThreatLevel.STABLE: "Normal baseline — no significant threats detected",
        ThreatLevel.ELEVATED: "Increased monitoring — above-normal activity detected",
        ThreatLevel.HEIGHTENED: "Multi-domain activity — significant threats in multiple categories",
        ThreatLevel.CRITICAL: "Major crisis conditions — immediate attention required",
    }.get(level, "Unknown")
