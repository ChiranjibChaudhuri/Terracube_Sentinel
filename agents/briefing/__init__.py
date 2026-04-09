"""
AI Briefing Engine — Automated intelligence briefing generation.
Generates SITREPs, daily briefings, and threat advisories.
"""

from .generator import BriefingGenerator
from .formatter import BriefingFormatter

__all__ = ["BriefingGenerator", "BriefingFormatter"]
