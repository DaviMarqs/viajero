"""Contrato base para enrichers de destino (Gemini, OpenAI, etc)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class EnrichmentResult:
    """Resultado de um enricher de destino, sem tocar no DB."""

    name: str = ""
    country: str = ""
    city: str = ""
    summary: str = ""
    best_season: str = ""
    timezone: str = ""
    pois: list[dict[str, Any]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    failures: list[dict[str, str]] = field(default_factory=list)

    def has_meaningful_data(self) -> bool:
        return bool(self.summary) or bool(self.pois)


class BaseDestinationEnricher:
    """Subclasses devolvem EnrichmentResult sem persistir."""

    def enrich(self, *, query: str, country: str = "", city: str = "") -> EnrichmentResult:
        raise NotImplementedError
