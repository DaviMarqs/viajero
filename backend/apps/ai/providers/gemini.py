"""Cliente do Gemini (Google) via google-generativeai SDK."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

import google.generativeai as genai
from django.conf import settings
from google.api_core import exceptions as google_exceptions

from .base import (
    LLMAuthError,
    LLMProviderError,
    LLMQuotaError,
    LLMResponseError,
    LLMTimeoutError,
)


logger = logging.getLogger(__name__)

_MARKDOWN_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class GeminiProvider:
    """Cliente do Gemini. Sem regras de negocio — so envia prompt e parseia retorno."""

    def __init__(self, model_name: str | None = None) -> None:
        self._model_name = model_name or settings.GEMINI_MODEL

    def _ensure_configured(self) -> None:
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            raise LLMAuthError("GEMINI_API_KEY nao configurada")
        genai.configure(api_key=api_key)

    def _build_model(self, system_instruction: str | None = None) -> genai.GenerativeModel:
        return genai.GenerativeModel(self._model_name, system_instruction=system_instruction)

    def _call(self, prompt: str, *, response_mime_type: str | None, timeout: float) -> str:
        self._ensure_configured()
        model = self._build_model()
        generation_config = {}
        if response_mime_type:
            generation_config["response_mime_type"] = response_mime_type
        try:
            response = model.generate_content(
                prompt,
                generation_config=generation_config or None,
                request_options={"timeout": timeout},
            )
        except google_exceptions.DeadlineExceeded as exc:
            raise LLMTimeoutError(f"Gemini timeout: {exc}") from exc
        except google_exceptions.ResourceExhausted as exc:
            raise LLMQuotaError(f"Gemini quota: {exc}") from exc
        except google_exceptions.PermissionDenied as exc:
            raise LLMAuthError(f"Gemini permissao: {exc}") from exc
        except google_exceptions.Unauthenticated as exc:
            raise LLMAuthError(f"Gemini auth: {exc}") from exc
        except google_exceptions.GoogleAPIError as exc:
            raise LLMProviderError(f"Gemini erro: {exc}") from exc
        text = (response.text or "").strip()
        if not text:
            raise LLMResponseError("Gemini retornou resposta vazia")
        return text

    def generate_text(self, prompt: str, *, timeout: float | None = None) -> str:
        return self._call(
            prompt,
            response_mime_type=None,
            timeout=timeout if timeout is not None else settings.GEMINI_TIMEOUT,
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
            response_mime_type="application/json",
            timeout=timeout if timeout is not None else settings.GEMINI_TIMEOUT,
        )
        cleaned = _MARKDOWN_FENCE_RE.sub("", text).strip()
        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            logger.warning("Gemini retornou JSON invalido: %s", cleaned[:200])
            raise LLMResponseError(f"JSON invalido: {exc}") from exc
        if not isinstance(payload, dict):
            raise LLMResponseError("JSON retornado nao e um objeto")
        return payload
