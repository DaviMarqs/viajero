import json
from unittest.mock import MagicMock, patch

import pytest
from google.api_core import exceptions as google_exceptions

from apps.ai.providers.base import (
    LLMAuthError,
    LLMQuotaError,
    LLMResponseError,
    LLMTimeoutError,
)
from apps.ai.providers.gemini import GeminiProvider


SCHEMA = {"type": "object", "properties": {"x": {"type": "string"}}}


def _build_response(text: str):
    response = MagicMock()
    response.text = text
    return response


def test_generate_json_returns_parsed_dict(settings):
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.return_value = _build_response(json.dumps({"x": "hello"}))
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        result = GeminiProvider().generate_json("prompt", SCHEMA)
    assert result == {"x": "hello"}


def test_generate_json_raises_auth_error_when_key_missing(settings):
    settings.GEMINI_API_KEY = ""
    with pytest.raises(LLMAuthError):
        GeminiProvider().generate_json("prompt", SCHEMA)


def test_generate_json_raises_timeout_on_deadline_exceeded(settings):
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.side_effect = google_exceptions.DeadlineExceeded("slow")
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        with pytest.raises(LLMTimeoutError):
            GeminiProvider().generate_json("prompt", SCHEMA)


def test_generate_json_raises_quota_on_429(settings):
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.side_effect = google_exceptions.ResourceExhausted("quota")
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        with pytest.raises(LLMQuotaError):
            GeminiProvider().generate_json("prompt", SCHEMA)


def test_generate_json_raises_auth_on_permission_denied(settings):
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.side_effect = google_exceptions.PermissionDenied("nope")
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        with pytest.raises(LLMAuthError):
            GeminiProvider().generate_json("prompt", SCHEMA)


def test_generate_json_raises_response_error_on_invalid_json(settings):
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.return_value = _build_response("not json {")
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        with pytest.raises(LLMResponseError):
            GeminiProvider().generate_json("prompt", SCHEMA)


def test_generate_json_strips_markdown_fence(settings):
    """Gemini as vezes envolve o JSON em ```json ... ``` — devemos limpar."""
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.return_value = _build_response(
        '```json\n{"x": "hello"}\n```'
    )
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        result = GeminiProvider().generate_json("prompt", SCHEMA)
    assert result == {"x": "hello"}


def test_generate_text_returns_string(settings):
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.return_value = _build_response("Hello world")
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        assert GeminiProvider().generate_text("prompt") == "Hello world"
