from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from apps.ai.generators.itinerary import GeminiItineraryGenerator
from apps.ai.providers.base import LLMResponseError, LLMTimeoutError
from apps.destinations.models import Destination, PointOfInterest


pytestmark = pytest.mark.django_db


def _make_itinerary():
    destination = Destination.objects.create(
        slug="curitiba",
        name="Curitiba",
        country="Brasil",
        city="Curitiba",
        summary="Capital paranaense.",
    )
    from apps.itineraries.models import Itinerary
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_user(username="u", password="x", email="u@u.com")
    itinerary = Itinerary.objects.create(
        user=user,
        destination=destination,
        title="Curitiba 4 dias",
        duration_days=4,
        budget_total=Decimal("2000"),
        currency_code="BRL",
    )
    return itinerary, destination


def _gemini_itinerary_payload(poi_id: int):
    return {
        "title": "Curitiba Cultural 4 Dias",
        "summary": "Imersao cultural pela capital paranaense.",
        "estimated_cost": "1850.00",
        "currency_code": "BRL",
        "days": [
            {
                "title": "Dia 1: Boas-vindas",
                "summary": "Tour pelo centro.",
                "events": [
                    {
                        "poi_id": poi_id,
                        "title": "Jardim Botanico",
                        "description": "Caminhada matinal.",
                        "estimated_cost": "0",
                        "order_index": 0,
                    },
                    {
                        "poi_id": None,
                        "title": "Almoco em barreado",
                        "description": "Prato tipico.",
                        "estimated_cost": "80",
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
        slug="jardim-botanico",
        name="Jardim Botanico",
        poi_type="attraction",
    )
    payload = _gemini_itinerary_payload(poi.id)

    fake_provider = MagicMock()
    fake_provider.generate_json.return_value = payload

    with patch(
        "apps.ai.generators.itinerary.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiItineraryGenerator().generate(
            itinerary=itinerary,
            profile=None,
            preferences=None,
            pois=[poi],
            prompt_template=None,
        )

    assert result["title"] == "Curitiba Cultural 4 Dias"
    assert len(result["days"]) == 1
    events = result["days"][0]["events"]
    assert events[0]["poi_id"] == poi.id
    assert events[1]["poi_id"] is None


def test_generate_nullifies_invalid_poi_id():
    itinerary, destination = _make_itinerary()
    poi = PointOfInterest.objects.create(
        destination=destination,
        slug="jardim-botanico",
        name="Jardim Botanico",
        poi_type="attraction",
    )
    payload = _gemini_itinerary_payload(poi_id=99999)  # nao existe

    fake_provider = MagicMock()
    fake_provider.generate_json.return_value = payload

    with patch(
        "apps.ai.generators.itinerary.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiItineraryGenerator().generate(
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
        "apps.ai.generators.itinerary.GeminiProvider",
        return_value=fake_provider,
    ):
        with pytest.raises(LLMResponseError):
            GeminiItineraryGenerator().generate(
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
        "apps.ai.generators.itinerary.GeminiProvider",
        return_value=fake_provider,
    ):
        with pytest.raises(LLMTimeoutError):
            GeminiItineraryGenerator().generate(
                itinerary=itinerary,
                profile=None,
                preferences=None,
                pois=[],
                prompt_template=None,
            )


def test_run_job_persists_valid_poi_id_in_event():
    """Integração: run_job consome poi_id do gerador e persiste FK no ItineraryDailyEvent."""
    from apps.ai.services import ItineraryGenerationService
    from apps.itineraries.models import ItineraryDailyEvent

    itinerary, destination = _make_itinerary()
    poi = PointOfInterest.objects.create(
        destination=destination,
        slug="jardim-botanico",
        name="Jardim Botanico",
        poi_type="attraction",
    )
    payload = _gemini_itinerary_payload(poi.id)

    fake_provider = MagicMock()
    fake_provider.generate_json.return_value = payload

    service = ItineraryGenerationService()
    job = service.create_job(itinerary=itinerary, user=itinerary.user)

    with patch(
        "apps.ai.generators.itinerary.GeminiProvider",
        return_value=fake_provider,
    ), patch(
        "apps.ai.services.get_generator",
        return_value=GeminiItineraryGenerator(),
    ):
        service.run_job(job)

    events = list(ItineraryDailyEvent.objects.filter(itinerary_day__itinerary=itinerary).order_by("order_index"))
    assert len(events) == 2
    assert events[0].poi_id == poi.id  # poi_id valido persistiu
    assert events[1].poi_id is None  # evento freestyle

    itinerary.refresh_from_db()
    assert itinerary.generation_status == "ready"
    assert itinerary.days.count() == 1


def test_build_context_includes_preferences():
    """Gemini context inclui budget_min/max, interests, hotel_level, etc."""
    from apps.profiles.models import UserTripPreference

    itinerary, destination = _make_itinerary()
    poi = PointOfInterest.objects.create(
        destination=destination,
        slug="jardim-botanico",
        name="Jardim Botanico",
        poi_type="attraction",
    )
    prefs = UserTripPreference.objects.create(
        user=itinerary.user,
        budget_min=Decimal("500"),
        budget_max=Decimal("2500"),
        currency_code="BRL",
        preferred_trip_length_days=7,
        hotel_level="boutique",
        interests=["cultura", "gastronomia"],
        dietary_preferences=["vegetarian"],
    )

    gen = GeminiItineraryGenerator()
    ctx = gen._build_context(itinerary, profile=None, preferences=prefs, pois=[poi])
    assert Decimal(ctx["preferences"]["budget_min"]) == Decimal("500")
    assert Decimal(ctx["preferences"]["budget_max"]) == Decimal("2500")
    assert ctx["preferences"]["preferred_trip_length_days"] == 7
    assert ctx["preferences"]["interests"] == ["cultura", "gastronomia"]
    assert ctx["preferences"]["dietary_preferences"] == ["vegetarian"]
    assert ctx["preferences"]["hotel_level"] == "boutique"
