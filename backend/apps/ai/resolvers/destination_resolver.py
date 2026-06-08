"""Resolve uma query livre de destino para um lugar real e canonico via Groq.

Guardrail ANTES da busca: normaliza o que o usuario digitou ("Formiga",
"Tokyo") para um lugar real ({name, country, city, region}), desambigua a
regiao e sinaliza quando a query nao e um destino de viagem (is_place=False).
Assim a descoberta nao "delira" (ex.: imagem de formiga inseto, ou Tokyo
empurrado para o Brasil pelo default do enricher).

Sem persistir nada e sem fazer regra de negocio fora da normalizacao.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from django.conf import settings

from apps.ai.providers.base import LLMProviderError, LLMResponseError
from apps.ai.providers.groq import GroqProvider


logger = logging.getLogger(__name__)


MIN_CONFIDENCE = 0.5

RESOLVER_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "country": {"type": "string"},
        "city": {"type": "string"},
        "region": {"type": "string"},
        "is_place": {"type": "boolean"},
        "confidence": {"type": "number"},
    },
    "required": ["name", "is_place", "confidence"],
}

RESOLVER_PROMPT = (
    "Voce normaliza buscas de destino de viagem. O usuario digitou: '{query}'.\n"
    "Identifique o LUGAR REAL e mais provavel que ele quis dizer e devolva JSON.\n"
    "- 'name': nome canonico do lugar.\n"
    "- 'country': pais real do lugar. NAO assuma Brasil; use o pais correto "
    "(ex.: 'Tokyo' -> Japao, nao Brasil).\n"
    "- 'city' e 'region': cidade e estado/regiao quando aplicavel "
    "(ex.: 'Formiga' -> cidade Formiga, regiao Minas Gerais, Brasil).\n"
    "- 'is_place': true apenas se for um destino de viagem real (cidade, "
    "regiao, pais, ponto turistico). false se for um objeto, animal, marca ou "
    "texto sem sentido (ex.: 'formiga' o inseto, 'asdfgh').\n"
    "- 'confidence': 0 a 1, quao seguro voce esta da identificacao.\n"
    "Se houver ambiguidade, escolha o destino de viagem mais conhecido."
)


@dataclass
class ResolvedDestination:
    name: str = ""
    country: str = ""
    city: str = ""
    region: str = ""
    is_place: bool = False
    confidence: float = 0.0

    def is_valid_place(self, threshold: float = MIN_CONFIDENCE) -> bool:
        return self.is_place and self.confidence >= threshold


class DestinationResolverService:
    """Normaliza uma query de destino. Fail-open: devolve None se Groq indisponivel."""

    def __init__(self, provider: GroqProvider | None = None) -> None:
        self._provider = provider

    def _get_provider(self) -> GroqProvider:
        if self._provider is None:
            self._provider = GroqProvider()
        return self._provider

    def resolve(self, raw_query: str) -> ResolvedDestination | None:
        query = (raw_query or "").strip()
        if not query:
            return None
        if not settings.GROQ_API_KEY:
            logger.info("Resolver de destino indisponivel: GROQ_API_KEY ausente")
            return None

        payload = self._call_with_retry(RESOLVER_PROMPT.format(query=query))
        if payload is None:
            return None

        return ResolvedDestination(
            name=str(payload.get("name") or "").strip()[:150],
            country=str(payload.get("country") or "").strip()[:100],
            city=str(payload.get("city") or "").strip()[:100],
            region=str(payload.get("region") or "").strip()[:100],
            is_place=bool(payload.get("is_place")),
            confidence=self._parse_confidence(payload.get("confidence")),
        )

    @staticmethod
    def _parse_confidence(value: Any) -> float:
        try:
            conf = float(value)
        except (TypeError, ValueError):
            return 0.0
        return max(0.0, min(1.0, conf))

    def _call_with_retry(self, prompt: str) -> dict[str, Any] | None:
        current = prompt
        for attempt in (1, 2):
            try:
                return self._get_provider().generate_json(
                    current,
                    RESOLVER_SCHEMA,
                    timeout=settings.GROQ_TIMEOUT,
                )
            except LLMResponseError as exc:
                logger.warning("Resolver de destino tentativa %d falhou: %s", attempt, exc)
                if attempt == 2:
                    return None
                current = (
                    f"{prompt}\n\nIMPORTANTE: responda APENAS com JSON valido, "
                    "sem texto antes ou depois."
                )
                continue
            except LLMProviderError as exc:
                logger.warning(
                    "Resolver de destino falhou com %s: %s", type(exc).__name__, exc
                )
                return None
        return None
