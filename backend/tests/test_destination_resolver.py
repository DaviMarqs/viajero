from unittest.mock import MagicMock

import pytest

from apps.ai.providers.base import LLMResponseError, LLMTimeoutError
from apps.ai.resolvers.destination_resolver import (
    DestinationResolverService,
    ResolvedDestination,
)


def test_resolve_returns_none_without_api_key(settings):
    settings.GROQ_API_KEY = ""
    assert DestinationResolverService().resolve("Tokyo") is None


def test_resolve_returns_none_for_empty_query(settings):
    settings.GROQ_API_KEY = "fake"
    settings.GROQ_TIMEOUT = 5
    provider = MagicMock()
    assert DestinationResolverService(provider=provider).resolve("   ") is None
    provider.generate_json.assert_not_called()


def test_resolve_disambiguates_formiga_to_city_in_minas(settings):
    settings.GROQ_API_KEY = "fake"
    settings.GROQ_TIMEOUT = 5
    provider = MagicMock()
    provider.generate_json.return_value = {
        "name": "Formiga",
        "country": "Brasil",
        "city": "Formiga",
        "region": "Minas Gerais",
        "is_place": True,
        "confidence": 0.92,
    }
    result = DestinationResolverService(provider=provider).resolve("Formiga")
    assert isinstance(result, ResolvedDestination)
    assert result.name == "Formiga"
    assert result.country == "Brasil"
    assert result.region == "Minas Gerais"
    assert result.is_place is True
    assert result.is_valid_place() is True


def test_resolve_keeps_tokyo_in_japan_not_brazil(settings):
    settings.GROQ_API_KEY = "fake"
    settings.GROQ_TIMEOUT = 5
    provider = MagicMock()
    provider.generate_json.return_value = {
        "name": "Tóquio",
        "country": "Japão",
        "city": "Tóquio",
        "region": "Kanto",
        "is_place": True,
        "confidence": 0.97,
    }
    result = DestinationResolverService(provider=provider).resolve("Tokyo")
    assert result.country == "Japão"
    assert result.country != "Brasil"


def test_resolve_flags_non_place(settings):
    settings.GROQ_API_KEY = "fake"
    settings.GROQ_TIMEOUT = 5
    provider = MagicMock()
    provider.generate_json.return_value = {
        "name": "",
        "country": "",
        "city": "",
        "region": "",
        "is_place": False,
        "confidence": 0.1,
    }
    result = DestinationResolverService(provider=provider).resolve("asdfgh")
    assert result.is_place is False
    assert result.is_valid_place() is False


def test_low_confidence_is_not_valid_place(settings):
    settings.GROQ_API_KEY = "fake"
    settings.GROQ_TIMEOUT = 5
    provider = MagicMock()
    provider.generate_json.return_value = {
        "name": "Lugar Duvidoso",
        "is_place": True,
        "confidence": 0.3,
    }
    result = DestinationResolverService(provider=provider).resolve("xyz")
    assert result.is_valid_place() is False


def test_resolve_retries_then_gives_up_on_invalid_json(settings):
    settings.GROQ_API_KEY = "fake"
    settings.GROQ_TIMEOUT = 5
    provider = MagicMock()
    provider.generate_json.side_effect = [LLMResponseError("a"), LLMResponseError("b")]
    assert DestinationResolverService(provider=provider).resolve("Paris") is None
    assert provider.generate_json.call_count == 2


def test_resolve_returns_none_on_provider_error(settings):
    settings.GROQ_API_KEY = "fake"
    settings.GROQ_TIMEOUT = 5
    provider = MagicMock()
    provider.generate_json.side_effect = LLMTimeoutError("slow")
    assert DestinationResolverService(provider=provider).resolve("Paris") is None
    assert provider.generate_json.call_count == 1


def test_resolve_handles_bad_confidence_value(settings):
    settings.GROQ_API_KEY = "fake"
    settings.GROQ_TIMEOUT = 5
    provider = MagicMock()
    provider.generate_json.return_value = {
        "name": "Roma",
        "country": "Itália",
        "is_place": True,
        "confidence": "muito alta",
    }
    result = DestinationResolverService(provider=provider).resolve("Roma")
    assert result.confidence == 0.0
    assert result.is_valid_place() is False
