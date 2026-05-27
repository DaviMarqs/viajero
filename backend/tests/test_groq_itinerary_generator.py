from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from apps.ai.generators.itinerary_groq import GroqItineraryGenerator
from apps.ai.providers.base import LLMResponseError, LLMTimeoutError
from apps.destinations.models import Destination, PointOfInterest


pytestmark = pytest.mark.django_db


def _make_itinerary():
    destination = Destination.objects.create(
        slug="floripa",
        name="Florianopolis",
        country="Brasil",
        city="Florianopolis",
        summary="A ilha da magia.",
    )
    from apps.itineraries.models import Itinerary
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_user(username="u2", password="x", email="u2@u.com")
    itinerary = Itinerary.objects.create(
        user=user,
        destination=destination,
        title="Floripa 3 dias",
        duration_days=3,
        budget_total=Decimal("1500"),
        currency_code="BRL",
    )
    return itinerary, destination


def _itinerary_payload(poi_id: int):
    return {
        "title": "Floripa Sol e Mar 3 Dias",
        "summary": "Explorando as praias e a cultura da ilha.",
        "estimated_cost": "1200.00",
        "currency_code": "BRL",
        "days": [
            {
                "title": "Dia 1: Chegada",
                "summary": "Conhecendo o centro historico.",
                "events": [
                    {
                        "poi_id": poi_id,
                        "title": "Mercado Publico",
                        "description": "Visita ao mercado central.",
                        "estimated_cost": "50",
                        "order_index": 0,
                    },
                    {
                        "poi_id": None,
                        "title": "Almoco de frutos do mar",
                        "description": "Restaurante tipico.",
                        "estimated_cost": "120",
                        "order_index": 1,
                    },
                ],
            }
        ],
    }


def test_generate_returns_normalized_dict_with_valid_poi_id():
    itinerary, destination = _make_itinerary()
    poi = PointOfInterest.objects.create(
        destination=destination,
        slug="mercado-publico",
        name="Mercado Publico",
        poi_type="attraction",
    )
    payload = _itinerary_payload(poi.id)

    fake_provider = MagicMock()
    fake_provider.generate_json.return_value = payload

    with patch(
        "apps.ai.generators.itinerary_groq.GroqProvider",
        return_value=fake_provider,
    ):
        result = GroqItineraryGenerator().generate(
            itinerary=itinerary,
            profile=None,
            preferences=None,
            pois=[poi],
            prompt_template=None,
        )

    assert result["title"] == "Floripa Sol e Mar 3 Dias"
    assert result["metadata"]["generator"] == "groq"
    assert len(result["days"]) == 1
    events = result["days"][0]["events"]
    assert events[0]["poi_id"] == poi.id
    assert events[1]["poi_id"] is None


def test_generate_nullifies_invalid_poi_id():
    itinerary, destination = _make_itinerary()
    poi = PointOfInterest.objects.create(
        destination=destination,
        slug="mercado-publico",
        name="Mercado Publico",
        poi_type="attraction",
    )
    payload = _itinerary_payload(poi_id=99999)  # nao existe

    fake_provider = MagicMock()
    fake_provider.generate_json.return_value = payload

    with patch(
        "apps.ai.generators.itinerary_groq.GroqProvider",
        return_value=fake_provider,
    ):
        result = GroqItineraryGenerator().generate(
            itinerary=itinerary,
            profile=None,
            preferences=None,
            pois=[poi],
            prompt_template=None,
        )

    assert result["days"][0]["events"][0]["poi_id"] is None


def test_generate_raises_after_retry_on_invalid_json():
    itinerary, _ = _make_itinerary()
    fake_provider = MagicMock()
    fake_provider.generate_json.side_effect = [LLMResponseError("a"), LLMResponseError("b")]

    with patch(
        "apps.ai.generators.itinerary_groq.GroqProvider",
        return_value=fake_provider,
    ):
        with pytest.raises(LLMResponseError):
            GroqItineraryGenerator().generate(
                itinerary=itinerary,
                profile=None,
                preferences=None,
                pois=[],
                prompt_template=None,
            )

    assert fake_provider.generate_json.call_count == 2


def test_generate_raises_on_timeout():
    itinerary, _ = _make_itinerary()
    fake_provider = MagicMock()
    fake_provider.generate_json.side_effect = LLMTimeoutError("slow")

    with patch(
        "apps.ai.generators.itinerary_groq.GroqProvider",
        return_value=fake_provider,
    ):
        with pytest.raises(LLMTimeoutError):
            GroqItineraryGenerator().generate(
                itinerary=itinerary,
                profile=None,
                preferences=None,
                pois=[],
                prompt_template=None,
            )

    assert fake_provider.generate_json.call_count == 1


def test_generate_metadata_contains_groq_model(settings):
    settings.GROQ_MODEL = "llama-3.3-70b-versatile"
    itinerary, destination = _make_itinerary()
    poi = PointOfInterest.objects.create(
        destination=destination,
        slug="mercado-publico-2",
        name="Mercado Publico",
        poi_type="attraction",
    )
    payload = _itinerary_payload(poi.id)

    fake_provider = MagicMock()
    fake_provider.generate_json.return_value = payload

    with patch(
        "apps.ai.generators.itinerary_groq.GroqProvider",
        return_value=fake_provider,
    ):
        result = GroqItineraryGenerator().generate(
            itinerary=itinerary,
            profile=None,
            preferences=None,
            pois=[poi],
            prompt_template=None,
        )

    assert result["metadata"]["model"] == "llama-3.3-70b-versatile"
