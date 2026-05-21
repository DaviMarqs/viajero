from unittest.mock import MagicMock, patch

import pytest

from apps.ai.enrichers.destination_gemini import GeminiDestinationEnricher
from apps.ai.providers.base import LLMResponseError, LLMTimeoutError


SAMPLE_PAYLOAD = {
    "name": "Bonito",
    "country": "Brasil",
    "city": "Bonito",
    "summary": "Cidade do Mato Grosso do Sul famosa pelas aguas cristalinas.",
    "best_season": "Maio a setembro",
    "timezone": "America/Campo_Grande",
    "pois": [
        {"name": "Gruta do Lago Azul", "type": "attraction", "summary": "Caverna com lago azul.", "tags": ["natureza"]},
        {"name": "Rio Sucuri", "type": "activity", "summary": "Flutuacao em rio cristalino.", "tags": ["aventura"]},
    ],
}


def test_enrich_returns_populated_result(settings):
    settings.GEMINI_API_KEY = "k"
    fake_provider = MagicMock()
    fake_provider.generate_json.return_value = SAMPLE_PAYLOAD
    with patch(
        "apps.ai.enrichers.destination_gemini.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiDestinationEnricher().enrich(query="Bonito", country="Brasil")
    assert result.summary.startswith("Cidade do Mato Grosso")
    assert len(result.pois) == 2
    assert result.metadata["model"] == settings.GEMINI_MODEL
    # Cada POI gerado pelo Gemini deve trazer marca de origem
    assert all(poi["source"] == "gemini" for poi in result.pois)
    # POIs nao devem conter image_url (nivel Moderado)
    assert all("image_url" not in poi for poi in result.pois)


def test_enrich_returns_empty_result_on_timeout(settings):
    settings.GEMINI_API_KEY = "k"
    fake_provider = MagicMock()
    fake_provider.generate_json.side_effect = LLMTimeoutError("slow")
    with patch(
        "apps.ai.enrichers.destination_gemini.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiDestinationEnricher().enrich(query="X")
    assert result.has_meaningful_data() is False
    assert len(result.failures) == 1
    assert result.failures[0]["error_type"] == "LLMTimeoutError"


def test_enrich_retries_once_on_response_error_then_succeeds(settings):
    settings.GEMINI_API_KEY = "k"
    fake_provider = MagicMock()
    fake_provider.generate_json.side_effect = [
        LLMResponseError("bad json"),
        SAMPLE_PAYLOAD,
    ]
    with patch(
        "apps.ai.enrichers.destination_gemini.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiDestinationEnricher().enrich(query="Bonito")
    assert fake_provider.generate_json.call_count == 2
    assert result.has_meaningful_data() is True


def test_enrich_returns_empty_after_two_response_errors(settings):
    settings.GEMINI_API_KEY = "k"
    fake_provider = MagicMock()
    fake_provider.generate_json.side_effect = [
        LLMResponseError("bad"),
        LLMResponseError("worse"),
    ]
    with patch(
        "apps.ai.enrichers.destination_gemini.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiDestinationEnricher().enrich(query="X")
    assert result.has_meaningful_data() is False
    assert fake_provider.generate_json.call_count == 2


def test_enrich_drops_pois_without_name_or_type(settings):
    settings.GEMINI_API_KEY = "k"
    fake_provider = MagicMock()
    fake_provider.generate_json.return_value = {
        "summary": "ok",
        "pois": [
            {"name": "Valido", "type": "attraction"},
            {"type": "attraction"},  # sem name
            {"name": "Sem tipo"},  # sem type
            {"name": "Tipo invalido", "type": "alien"},  # tipo nao na enum
        ],
    }
    with patch(
        "apps.ai.enrichers.destination_gemini.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiDestinationEnricher().enrich(query="X")
    # So o "Valido" deve passar; "Tipo invalido" cai no fallback "activity"
    names = [p["name"] for p in result.pois]
    assert "Valido" in names
    assert "Tipo invalido" in names
    assert len(result.pois) == 2
