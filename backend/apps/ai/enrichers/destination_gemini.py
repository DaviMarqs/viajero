"""Enricher de destino via Gemini — fallback complementar ao Firecrawl."""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings

from apps.ai.providers.base import LLMProviderError, LLMResponseError
from apps.ai.providers.gemini import GeminiProvider

from .base import BaseDestinationEnricher, EnrichmentResult


logger = logging.getLogger(__name__)


VALID_POI_TYPES = {"attraction", "restaurant", "activity", "lodging"}

ENRICHMENT_PROMPT = (
    "Voce e uma fonte de dados de viagem. Para o destino '{query}' "
    "(pais: {country}, cidade: {city}), devolva JSON estruturado conforme o schema. "
    "Foque em informacao factual e atemporal. "
    "Para 'summary' use 2 a 3 paragrafos curtos. "
    "Para 'pois' liste ate 10 pontos REAIS e conhecidos, sem inventar URLs. "
    "'type' deve ser exatamente um destes valores: attraction, restaurant, activity, lodging. "
    "Se nao tiver certeza de algum campo, deixe vazio (string vazia ou array vazio)."
)

ENRICHMENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "country": {"type": "string"},
        "city": {"type": "string"},
        "summary": {"type": "string"},
        "best_season": {"type": "string"},
        "timezone": {"type": "string"},
        "pois": {
            "type": "array",
            "maxItems": 10,
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "type": {
                        "type": "string",
                        "enum": list(VALID_POI_TYPES),
                    },
                    "summary": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["name", "type"],
            },
        },
    },
}


class GeminiDestinationEnricher(BaseDestinationEnricher):
    def __init__(self, provider: GeminiProvider | None = None) -> None:
        self._provider = provider or GeminiProvider()

    def enrich(self, *, query: str, country: str = "", city: str = "") -> EnrichmentResult:
        prompt = ENRICHMENT_PROMPT.format(
            query=query,
            country=country or "Brasil",
            city=city or "(nao informado)",
        )
        payload = self._call_with_retry(prompt)
        if payload is None:
            return EnrichmentResult(failures=self._failures_so_far)
        return self._build_result(payload)

    def _call_with_retry(self, prompt: str) -> dict[str, Any] | None:
        self._failures_so_far: list[dict[str, str]] = []
        for attempt in (1, 2):
            try:
                return self._provider.generate_json(
                    prompt,
                    ENRICHMENT_SCHEMA,
                    timeout=settings.GEMINI_TIMEOUT,
                )
            except LLMResponseError as exc:
                logger.warning(
                    "Gemini enrich tentativa %d falhou com LLMResponseError: %s",
                    attempt, exc,
                )
                self._failures_so_far.append(
                    {"attempt": str(attempt), "error_type": "LLMResponseError", "error": str(exc)}
                )
                if attempt == 2:
                    return None
                continue
            except LLMProviderError as exc:
                logger.warning(
                    "Gemini enrich falhou com %s: %s", type(exc).__name__, exc,
                )
                self._failures_so_far.append(
                    {"attempt": str(attempt), "error_type": type(exc).__name__, "error": str(exc)}
                )
                return None
        return None

    def _build_result(self, payload: dict[str, Any]) -> EnrichmentResult:
        pois = self._sanitize_pois(payload.get("pois") or [])
        return EnrichmentResult(
            name=str(payload.get("name") or "")[:150],
            country=str(payload.get("country") or "")[:100],
            city=str(payload.get("city") or "")[:100],
            summary=str(payload.get("summary") or "")[:4000],
            best_season=str(payload.get("best_season") or "")[:120],
            timezone=str(payload.get("timezone") or "")[:64],
            pois=pois,
            metadata={"model": settings.GEMINI_MODEL, "source": "gemini"},
            failures=getattr(self, "_failures_so_far", []),
        )

    @staticmethod
    def _sanitize_pois(raw_pois: list[Any]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for raw in raw_pois:
            if not isinstance(raw, dict):
                continue
            name = (raw.get("name") or "").strip()
            if not name:
                continue
            raw_type = (raw.get("type") or "").strip().lower()
            if not raw_type:
                continue
            poi_type = raw_type if raw_type in VALID_POI_TYPES else "activity"
            tags_raw = raw.get("tags") or []
            tags = [str(t).strip() for t in tags_raw if isinstance(t, str) and str(t).strip()]
            out.append(
                {
                    "name": name[:160],
                    "type": poi_type,
                    "summary": str(raw.get("summary") or "")[:4000],
                    "tags": tags,
                    "source": "gemini",
                }
            )
        return out
