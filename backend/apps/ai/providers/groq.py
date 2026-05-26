"""Cliente do Groq (Llama/Mixtral) via groq SDK — OpenAI-compatible."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from django.conf import settings
from groq import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    AuthenticationError,
    Groq,
    PermissionDeniedError,
    RateLimitError,
)

from .base import (
    LLMAuthError,
    LLMProviderError,
    LLMQuotaError,
    LLMResponseError,
    LLMTimeoutError,
)


logger = logging.getLogger(__name__)

_MARKDOWN_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class GroqProvider:
    """Cliente Groq. Sem regras de negocio — so envia prompt e parseia retorno."""

    def __init__(self, model_name: str | None = None) -> None:
        self._model_name = model_name or settings.GROQ_MODEL

    def _client(self, timeout: float) -> Groq:
        api_key = settings.GROQ_API_KEY
        if not api_key:
            raise LLMAuthError("GROQ_API_KEY nao configurada")
        return Groq(api_key=api_key, timeout=timeout)

    def _call(
        self,
        prompt: str,
        *,
        response_format: dict[str, Any] | None,
        timeout: float,
    ) -> str:
        client = self._client(timeout)
        kwargs: dict[str, Any] = {
            "model": self._model_name,
            "messages": [{"role": "user", "content": prompt}],
        }
        if response_format:
            kwargs["response_format"] = response_format
        try:
            response = client.chat.completions.create(**kwargs)
        except APITimeoutError as exc:
            raise LLMTimeoutError(f"Groq timeout: {exc}") from exc
        except RateLimitError as exc:
            raise LLMQuotaError(f"Groq quota: {exc}") from exc
        except AuthenticationError as exc:
            raise LLMAuthError(f"Groq auth: {exc}") from exc
        except PermissionDeniedError as exc:
            raise LLMAuthError(f"Groq permissao: {exc}") from exc
        except APIConnectionError as exc:
            raise LLMTimeoutError(f"Groq conexao: {exc}") from exc
        except APIError as exc:
            raise LLMProviderError(f"Groq erro: {exc}") from exc

        try:
            text = (response.choices[0].message.content or "").strip()
        except (AttributeError, IndexError) as exc:
            raise LLMResponseError(f"Groq retornou shape inesperado: {exc}") from exc
        if not text:
            raise LLMResponseError("Groq retornou resposta vazia")
        return text

    def generate_text(self, prompt: str, *, timeout: float | None = None) -> str:
        return self._call(
            prompt,
            response_format=None,
            timeout=timeout if timeout is not None else settings.GROQ_TIMEOUT,
        )

    def generate_json(
        self,
        prompt: str,
        schema: dict[str, Any],
        *,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        full_prompt = (
            f"{prompt}\n\n"
            "Responda APENAS com JSON valido aderente ao schema abaixo, "
            "sem cercas de markdown e sem texto adicional:\n"
            f"{json.dumps(schema, ensure_ascii=False)}"
        )
        text = self._call(
            full_prompt,
            response_format={"type": "json_object"},
            timeout=timeout if timeout is not None else settings.GROQ_TIMEOUT,
        )
        cleaned = _MARKDOWN_FENCE_RE.sub("", text).strip()
        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            logger.warning("Groq retornou JSON invalido: %s", cleaned[:200])
            raise LLMResponseError(f"JSON invalido: {exc}") from exc
        if not isinstance(payload, dict):
            raise LLMResponseError("JSON retornado nao e um objeto")
        return payload
