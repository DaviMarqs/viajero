from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from apps.destinations.models import Destination


pytestmark = pytest.mark.django_db


def _make_destination(**overrides) -> Destination:
    defaults = {
        "slug": "sao-paulo",
        "name": "São Paulo",
        "country": "Brasil",
        "city": "São Paulo",
        "summary": "Capital paulista.",
    }
    defaults.update(overrides)
    return Destination.objects.create(**defaults)


def test_search_returns_enriched_destination_even_when_local_filter_misses_accents():
    """
    Regressao: query 'Sao Paulo' (sem acento) com destino 'São Paulo' (com til)
    cria via discover_destination mas o _local_search por icontains nao casa em
    SQLite. O response deve conter o destino mesmo assim.
    """
    accented = _make_destination()

    with patch(
        "apps.destinations.views.FirecrawlIngestionService.discover_destination",
        return_value=accented,
    ):
        client = APIClient()
        response = client.get("/api/destinations/search/?q=Sao Paulo")

    assert response.status_code == 200
    body = response.json()
    slugs = [item["slug"] for item in body["data"]]
    assert "sao-paulo" in slugs
    assert "enriquecido via Firecrawl" in body["message"]


def test_search_skips_firecrawl_when_local_results_exist():
    _make_destination(slug="paris", name="Paris", country="Franca", city="Paris", summary="")

    with patch(
        "apps.destinations.views.FirecrawlIngestionService.discover_destination",
    ) as discover:
        client = APIClient()
        response = client.get("/api/destinations/search/?q=Paris")

    assert response.status_code == 200
    discover.assert_not_called()
    body = response.json()
    assert any(item["slug"] == "paris" for item in body["data"])


def test_search_returns_empty_when_discover_returns_none():
    with patch(
        "apps.destinations.views.FirecrawlIngestionService.discover_destination",
        return_value=None,
    ):
        client = APIClient()
        response = client.get("/api/destinations/search/?q=lugar-inexistente")

    assert response.status_code == 200
    body = response.json()
    assert body["data"] == []
    assert "enriquecido" not in body["message"]
