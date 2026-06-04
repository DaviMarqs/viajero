from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model

from apps.ai.providers.base import LLMResponseError, LLMTimeoutError
from apps.ai.suggesters.destination_suggester import (
    DestinationSuggestion,
    DestinationSuggestionService,
)

pytestmark = pytest.mark.django_db


def _user():
    return get_user_model().objects.create_user(username="s", password="x", email="s@s.com")


def test_suggest_returns_none_without_api_key(settings):
    settings.GROQ_API_KEY = ""
    assert DestinationSuggestionService().suggest(_user()) is None


def test_suggest_returns_suggestion(settings):
    settings.GROQ_API_KEY = "fake"
    settings.GROQ_TIMEOUT = 5
    provider = MagicMock()
    provider.generate_json.return_value = {
        "destination_name": "Lisboa",
        "country": "Portugal",
        "city": "Lisboa",
        "rationale": "Combina com seu perfil cultural.",
    }
    service = DestinationSuggestionService(provider=provider)
    result = service.suggest(_user())
    assert isinstance(result, DestinationSuggestion)
    assert result.name == "Lisboa"
    assert result.country == "Portugal"
    assert provider.generate_json.call_count == 1


def test_suggest_returns_none_when_name_missing(settings):
    settings.GROQ_API_KEY = "fake"
    settings.GROQ_TIMEOUT = 5
    provider = MagicMock()
    provider.generate_json.return_value = {"destination_name": "  "}
    assert DestinationSuggestionService(provider=provider).suggest(_user()) is None


def test_suggest_retries_then_gives_up_on_invalid_json(settings):
    settings.GROQ_API_KEY = "fake"
    settings.GROQ_TIMEOUT = 5
    provider = MagicMock()
    provider.generate_json.side_effect = [LLMResponseError("a"), LLMResponseError("b")]
    assert DestinationSuggestionService(provider=provider).suggest(_user()) is None
    assert provider.generate_json.call_count == 2


def test_suggest_returns_none_on_provider_error(settings):
    settings.GROQ_API_KEY = "fake"
    settings.GROQ_TIMEOUT = 5
    provider = MagicMock()
    provider.generate_json.side_effect = LLMTimeoutError("slow")
    assert DestinationSuggestionService(provider=provider).suggest(_user()) is None
    assert provider.generate_json.call_count == 1


def test_suggest_excludes_already_generated_destinations(settings):
    settings.GROQ_API_KEY = "fake"
    settings.GROQ_TIMEOUT = 5

    from apps.destinations.models import Destination
    from apps.itineraries.models import Itinerary

    user = _user()
    destination = Destination.objects.create(
        slug="lisboa", name="Lisboa", country="Portugal"
    )
    Itinerary.objects.create(
        user=user, destination=destination, title="Roteiro Lisboa", duration_days=3
    )

    provider = MagicMock()
    provider.generate_json.return_value = {"destination_name": "Salvador"}
    DestinationSuggestionService(provider=provider).suggest(user)

    prompt = provider.generate_json.call_args.args[0]
    assert "Lisboa" in prompt
    assert "destino DIFERENTE" in prompt
