from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.ai.suggesters.destination_suggester import DestinationSuggestion
from apps.destinations.models import Destination

pytestmark = pytest.mark.django_db


def _client():
    user = get_user_model().objects.create_user(username="e", password="x", email="e@e.com")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_suggest_endpoint_requires_auth():
    response = APIClient().post("/api/destinations/suggest/")
    assert response.status_code in (401, 403)


def test_suggest_endpoint_returns_local_destination():
    client = _client()
    Destination.objects.create(slug="lisboa", name="Lisboa", country="Portugal", city="Lisboa")

    suggestion = DestinationSuggestion(name="Lisboa", country="Portugal", city="Lisboa", rationale="ok")
    with patch(
        "apps.destinations.views.DestinationSuggestionService"
    ) as service_cls:
        service_cls.return_value.suggest.return_value = suggestion
        with patch("apps.destinations.views.DestinationDiscoveryService") as discovery_cls:
            response = client.post("/api/destinations/suggest/")
            discovery_cls.return_value.discover.assert_not_called()

    assert response.status_code == 200, response.content
    body = response.json()
    assert body["success"] is True
    assert body["data"]["name"] == "Lisboa"


def test_suggest_endpoint_discovers_when_not_local():
    client = _client()
    suggestion = DestinationSuggestion(name="Quioto", country="Japao", city="Quioto", rationale="ok")
    discovered = Destination.objects.create(slug="kyoto", name="Kyoto", country="Japao", city="Kyoto")

    with patch("apps.destinations.views.DestinationSuggestionService") as service_cls:
        service_cls.return_value.suggest.return_value = suggestion
        with patch("apps.destinations.views.DestinationDiscoveryService") as discovery_cls:
            discovery_cls.return_value.discover.return_value = discovered
            response = client.post("/api/destinations/suggest/")
            discovery_cls.return_value.discover.assert_called_once()

    assert response.status_code == 200, response.content
    assert response.json()["data"]["name"] == "Kyoto"


def test_suggest_endpoint_503_when_no_suggestion():
    client = _client()
    with patch("apps.destinations.views.DestinationSuggestionService") as service_cls:
        service_cls.return_value.suggest.return_value = None
        response = client.post("/api/destinations/suggest/")

    assert response.status_code == 503
    assert response.json()["success"] is False


def test_suggest_endpoint_503_when_discovery_fails():
    client = _client()
    suggestion = DestinationSuggestion(name="Atlantida", country="?", city="", rationale="")
    with patch("apps.destinations.views.DestinationSuggestionService") as service_cls:
        service_cls.return_value.suggest.return_value = suggestion
        with patch("apps.destinations.views.DestinationDiscoveryService") as discovery_cls:
            discovery_cls.return_value.discover.return_value = None
            response = client.post("/api/destinations/suggest/")

    assert response.status_code == 503
    assert response.json()["success"] is False
