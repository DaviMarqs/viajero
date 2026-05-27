from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.destinations.models import Destination
from apps.itineraries.models import Itinerary
from apps.profiles.models import UserTripPreference


pytestmark = pytest.mark.django_db


def _setup(user_kwargs=None):
    User = get_user_model()
    user = User.objects.create_user(
        username="u",
        password="x",
        email="u@u.com",
        **(user_kwargs or {}),
    )
    destination = Destination.objects.create(
        slug="paris",
        name="Paris",
        country="Franca",
    )
    return user, destination


def test_create_itinerary_inherits_duration_and_budget_from_prefs():
    user, destination = _setup()
    UserTripPreference.objects.create(
        user=user,
        budget_min=Decimal("1000"),
        budget_max=Decimal("3000"),
        currency_code="EUR",
        preferred_trip_length_days=7,
    )

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post(
        "/api/itineraries/",
        {"destination": destination.id, "title": "Paris"},
        format="json",
    )

    assert response.status_code == 201, response.content
    itinerary = Itinerary.objects.get(user=user)
    assert itinerary.duration_days == 7
    assert itinerary.budget_total == Decimal("2000")  # media de 1000-3000
    assert itinerary.currency_code == "EUR"


def test_create_itinerary_respects_explicit_payload_over_prefs():
    user, destination = _setup()
    UserTripPreference.objects.create(
        user=user,
        budget_min=Decimal("1000"),
        budget_max=Decimal("3000"),
        currency_code="EUR",
        preferred_trip_length_days=7,
    )

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post(
        "/api/itineraries/",
        {
            "destination": destination.id,
            "title": "Override",
            "duration_days": 14,
            "budget_total": "5000",
            "currency_code": "BRL",
        },
        format="json",
    )

    assert response.status_code == 201, response.content
    itinerary = Itinerary.objects.get(user=user)
    assert itinerary.duration_days == 14
    assert itinerary.budget_total == Decimal("5000")
    assert itinerary.currency_code == "BRL"


def test_create_itinerary_without_prefs_uses_fallback_duration():
    user, destination = _setup()

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post(
        "/api/itineraries/",
        {"destination": destination.id, "title": "X"},
        format="json",
    )

    assert response.status_code == 201, response.content
    itinerary = Itinerary.objects.get(user=user)
    assert itinerary.duration_days == 5  # fallback
