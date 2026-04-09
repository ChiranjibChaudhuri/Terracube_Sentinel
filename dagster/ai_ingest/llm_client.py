"""Unified LLM client for AI ingestion pipeline.

Supports three backends:
  - Ollama (local)          — /api/generate
  - OpenAI-compatible (ZAI) — /chat/completions
Gracefully degrades when the LLM backend is unavailable.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

from .config import LLMSettings

logger = logging.getLogger(__name__)


class LLMClient:
    """Unified interface to Ollama / OpenAI-compatible LLM backends."""

    def __init__(self, settings: LLMSettings | None = None) -> None:
        self._settings = settings or LLMSettings()
        self._available: bool | None = None  # lazy probe
        self._total_prompt_tokens = 0
        self._total_completion_tokens = 0
        self._total_calls = 0

    # ── public helpers ────────────────────────────────────────────────

    @property
    def stats(self) -> dict[str, Any]:
        return {
            "backend": self._settings.backend,
            "model": self._settings.model,
            "total_calls": self._total_calls,
            "est_prompt_tokens": self._total_prompt_tokens,
            "est_completion_tokens": self._total_completion_tokens,
        }

    def is_available(self) -> bool:
        """Check whether the LLM backend is reachable (cached after first probe)."""
        if self._available is not None:
            return self._available

        try:
            with httpx.Client(timeout=5) as client:
                if self._settings.backend == "ollama":
                    resp = client.get(f"{self._settings.base_url}/api/tags")
                    self._available = resp.status_code == 200
                else:
                    # OpenAI-compatible: hit /models endpoint
                    headers = self._auth_headers()
                    resp = client.get(
                        f"{self._settings.base_url}/models",
                        headers=headers,
                    )
                    self._available = resp.status_code == 200
        except Exception:
            self._available = False
        return self._available

    # ── core methods ──────────────────────────────────────────────────

    def complete(self, prompt: str, system: str = "") -> str | None:
        """Send a completion request. Returns None if LLM is unavailable."""
        if not self.is_available():
            return None

        if self._settings.backend == "ollama":
            return self._complete_ollama(prompt, system)
        else:
            return self._complete_openai(prompt, system)

    def extract_json(self, prompt: str, system: str = "") -> dict | None:
        """Send a prompt and parse the response as JSON.

        If the LLM returns text wrapped around a JSON block, the method
        attempts to extract the first ``{...}`` or ``[...]`` substring.
        """
        raw = self.complete(prompt, system)
        if raw is None:
            return None
        return self._parse_json(raw)

    def batch_extract(self, items: list[dict], prompt_template: str,
                      system: str = "") -> list[dict]:
        """Run extract_json for each item, substituting into *prompt_template*.

        ``prompt_template`` should contain ``{item}`` as a placeholder.
        """
        results: list[dict] = []
        for item in items:
            rendered = prompt_template.replace("{item}", json.dumps(item, default=str))
            parsed = self.extract_json(rendered, system)
            results.append(parsed if parsed is not None else {})
        return results

    # ── OpenAI-compatible backend ─────────────────────────────────────

    def _complete_openai(self, prompt: str, system: str) -> str | None:
        """Call /chat/completions (OpenAI / ZAI / GLM)."""
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload: dict[str, Any] = {
            "model": self._settings.model,
            "messages": messages,
            "temperature": self._settings.temperature,
            "max_tokens": self._settings.max_tokens,
        }

        headers = self._auth_headers()
        body = self._post("/chat/completions", payload, headers=headers)
        if body is None:
            return None

        # Extract content from OpenAI response format
        try:
            content = body["choices"][0]["message"]["content"]
            usage = body.get("usage", {})
            self._total_prompt_tokens += usage.get("prompt_tokens", 0)
            self._total_completion_tokens += usage.get("completion_tokens", 0)
            return content
        except (KeyError, IndexError, TypeError) as exc:
            logger.error("Unexpected OpenAI response format: %s", exc)
            return None

    # ── Ollama backend ────────────────────────────────────────────────

    def _complete_ollama(self, prompt: str, system: str) -> str | None:
        """Call /api/generate (Ollama)."""
        payload: dict[str, Any] = {
            "model": self._settings.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": self._settings.temperature,
                "num_predict": self._settings.max_tokens,
            },
        }
        if system:
            payload["system"] = system

        body = self._post("/api/generate", payload)
        if body is None:
            return None

        self._track_tokens(prompt, body.get("response", ""))
        return body.get("response")

    # ── internals ─────────────────────────────────────────────────────

    def _auth_headers(self) -> dict[str, str]:
        """Build Authorization header for OpenAI-compatible APIs."""
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self._settings.api_key:
            headers["Authorization"] = f"Bearer {self._settings.api_key}"
        return headers

    def _post(self, path: str, payload: dict,
              headers: dict[str, str] | None = None) -> dict | None:
        """POST to the LLM backend with retry + exponential backoff."""
        url = f"{self._settings.base_url}{path}"
        if headers is None:
            headers = {"Content-Type": "application/json"}
        last_exc: Exception | None = None

        for attempt in range(3):
            try:
                with httpx.Client(timeout=self._settings.timeout) as client:
                    resp = client.post(url, json=payload, headers=headers)
                    resp.raise_for_status()
                    self._total_calls += 1
                    return resp.json()
            except (httpx.HTTPError, httpx.TimeoutException) as exc:
                last_exc = exc
                wait = 2 ** attempt  # 1, 2, 4 seconds
                logger.warning(
                    "LLM request failed (attempt %d/3): %s — retrying in %ds",
                    attempt + 1, exc, wait,
                )
                time.sleep(wait)

        logger.error("LLM request failed after 3 attempts: %s", last_exc)
        self._available = False  # mark down so subsequent calls skip quickly
        return None

    @staticmethod
    def _parse_json(text: str) -> dict | None:
        """Best-effort JSON extraction from LLM output."""
        text = text.strip()
        # Strip markdown code fences (```json ... ``` or ``` ... ```)
        if text.startswith("```"):
            first_newline = text.find("\n")
            if first_newline != -1:
                text = text[first_newline + 1:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try to find a JSON object or array in the response
        for start_char, end_char in [("{", "}"), ("[", "]")]:
            start = text.find(start_char)
            if start == -1:
                continue
            depth = 0
            for i in range(start, len(text)):
                if text[i] == start_char:
                    depth += 1
                elif text[i] == end_char:
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start:i + 1])
                        except json.JSONDecodeError:
                            break
        return None

    def _track_tokens(self, prompt: str, response: str) -> None:
        """Rough token estimate (1 token ≈ 4 chars) for backends without usage info."""
        self._total_prompt_tokens += len(prompt) // 4
        self._total_completion_tokens += len(response) // 4
