"""Integracao: run_job aplica precisao de valores e persiste no banco."""
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from apps.ai.services import ItineraryGenerationService
from apps.destinations.models import Destination, PointOfInterest
from apps.itineraries.models import Itinerary
from apps.profiles.models import UserTripPreference

pytestmark = pytest.mark.django_db


def _setup(duration_days=2, with_prefs=True):
    user = get_user_model().objects.create_user(username="g", password="x", email="g@g.com")
    destination = Destination.objects.create(slug="roma", name="Roma", country="Italia", city="Roma")
    for i in range(6):
        PointOfInterest.objects.create(
            destination=destination,
            slug=f"poi-{i}",
            name=f"POI {i}",
            poi_type="attraction",
            rating=5 - i * 0.1,
        )
    itinerary = Itinerary.objects.create(
        user=user,
        destination=destination,
        title="Roma",
        duration_days=duration_days,
        budget_total=Decimal("2000"),
        currency_code="EUR",
    )
    if with_prefs:
        UserTripPreference.objects.create(
            user=user,
            budget_min=Decimal("1000"),
            budget_max=Decimal("1500"),
            currency_code="EUR",
            preferred_trip_length_days=duration_days,
        )
    return user, itinerary


def test_run_job_clamps_total_into_budget_and_persists(settings):
    settings.DEFAULT_LLM_PROVIDER = "mock"
    user, itinerary = _setup(duration_days=2)

    service = ItineraryGenerationService()
    job = service.create_job(itinerary=itinerary, user=user)
    service.run_job(job)

    itinerary.refresh_from_db()
    assert itinerary.generation_status == "ready"
    assert itinerary.currency_code == "EUR"

    assert Decimal("1000") <= itinerary.budget_total <= Decimal("1500")

    days = list(itinerary.days.all())
    assert days
    soma_dias = sum((d.estimated_cost for d in days), Decimal("0"))
    assert soma_dias == itinerary.budget_total

    for day in days:
        soma_eventos = sum((e.estimated_cost for e in day.events.all()), Decimal("0"))
        assert soma_eventos == day.estimated_cost


def test_run_job_without_prefs_keeps_consistent_totals(settings):
    settings.DEFAULT_LLM_PROVIDER = "mock"
    user, itinerary = _setup(duration_days=2, with_prefs=False)

    service = ItineraryGenerationService()
    job = service.create_job(itinerary=itinerary, user=user)
    service.run_job(job)

    itinerary.refresh_from_db()
    assert itinerary.generation_status == "ready"
    soma_dias = sum((d.estimated_cost for d in itinerary.days.all()), Decimal("0"))
    assert soma_dias == itinerary.budget_total
