"""Exceções e contratos comuns para LLM providers."""
from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


class LLMProviderError(Exception):
    """Erro genérico de qualquer provider de LLM."""


class LLMTimeoutError(LLMProviderError):
    """O provider não respondeu dentro do timeout configurado."""


class LLMAuthError(LLMProviderError):
    """Credencial inválida ou ausente."""


class LLMQuotaError(LLMProviderError):
    """Rate limit ou cota excedida."""


class LLMResponseError(LLMProviderError):
    """Resposta vazia, JSON inválido ou fora do schema esperado."""


@runtime_checkable
class LLMProvider(Protocol):
    """Contrato de um provider de LLM (Gemini, OpenAI etc)."""

    def generate_json(
        self,
        prompt: str,
        schema: dict[str, Any],
        *,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        ...

    def generate_text(self, prompt: str, *, timeout: float | None = None) -> str:
        ...
