"""
AI Briefing Engine — Automated intelligence briefing generation.
Generates SITREPs, daily briefings, and threat advisories.
"""

from agents.briefing.generator import BriefingGenerator
from agents.briefing.formatter import BriefingFormatter

__all__ = ["BriefingGenerator", "BriefingFormatter"]
