"""
Global Stability Engine (GSE) — Multi-factor stability computation.
Inspired by OSINT-MONITOR's intelligence-grade event processing.
"""

from .engine import GlobalStabilityEngine
from .threat_levels import ThreatLevel, get_threat_level, ESCALATION_THRESHOLD
from .patterns import PatternDetector
from .scoring import GSEScorer

__all__ = [
    "GlobalStabilityEngine",
    "ThreatLevel",
    "get_threat_level",
    "ESCALATION_THRESHOLD",
    "PatternDetector",
    "GSEScorer",
]
