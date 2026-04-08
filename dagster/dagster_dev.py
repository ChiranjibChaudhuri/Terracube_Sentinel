"""Dagster dev server entry point.

Run with:
    dagster dev -f dagster_dev.py
"""

from pipelines import defs  # noqa: F401 — Dagster discovers `defs` at module level
