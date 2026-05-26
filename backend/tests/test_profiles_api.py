import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


pytestmark = pytest.mark.django_db

User = get_user_model()


def test_traveler_dna_me_supports_empty_get_and_patch_upsert():
    user = User.objects.create_user(email="dna@example.com", username="dna@example.com", password="secret123")
    client = APIClient()
    client.force_authenticate(user=user)

    empty_response = client.get("/api/traveler-dna/me/")

    assert empty_response.status_code == 200
    assert empty_response.json()["data"] is None

    payload = {
        "travel_style": "food_culture",
        "pace": "balanced",
        "comfort_level": "standard",
        "social_energy": 6,
        "adventure_level": 4,
        "food_focus": 8,
        "cultural_interest": 8,
        "nature_interest": 3,
        "nightlife_interest": 2,
        "notes": '{"companionship":"friends"}',
    }

    create_response = client.patch("/api/traveler-dna/me/", payload, format="json")

    assert create_response.status_code == 201
    assert create_response.json()["data"]["travel_style"] == "food_culture"

    update_response = client.patch("/api/traveler-dna/me/", {"pace": "relaxed"}, format="json")

    assert update_response.status_code == 200
    assert update_response.json()["data"]["pace"] == "relaxed"


def test_trip_preferences_me_supports_patch_upsert():
    user = User.objects.create_user(email="prefs@example.com", username="prefs@example.com", password="secret123")
    client = APIClient()
    client.force_authenticate(user=user)

    payload = {
        "budget_min": "500.00",
        "budget_max": "1500.00",
        "currency_code": "BRL",
        "preferred_trip_length_days": 7,
        "travel_month": "June",
        "hotel_level": "mid",
        "transportation_style": "public",
        "dietary_preferences": ["vegetarian"],
        "accessibility_needs": [],
        "interests": ["food", "culture"],
        "metadata": {"flexible_dates": True},
    }

    response = client.patch("/api/trip-preferences/me/", payload, format="json")

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["currency_code"] == "BRL"
    assert data["metadata"]["flexible_dates"] is True
