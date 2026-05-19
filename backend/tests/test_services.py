from unittest.mock import patch

import pytest

from apps.destinations.models import Destination, PointOfInterest
from apps.integrations.services import FirecrawlError, FirecrawlIngestionService


pytestmark = pytest.mark.django_db


def _firecrawl_search_response(urls: list[str]) -> dict:
    return {"success": True, "data": [{"url": u, "title": u} for u in urls]}


def _firecrawl_scrape_response(payload: dict) -> dict:
    return {"success": True, "data": {"json": payload}}


class FakeResponse:
    def __init__(self, status_code: int, body: dict):
        self.status_code = status_code
        self._body = body

    def json(self):
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            import requests

            raise requests.HTTPError(f"HTTP {self.status_code}")


def test_discover_destination_uses_mock_when_no_api_key(settings):
    settings.FIRECRAWL_API_KEY = ""

    destination = FirecrawlIngestionService().discover_destination(query="Atlantis")

    assert destination is not None
    assert destination.slug == "atlantis"
    assert destination.summary.startswith("Resumo curado para")
    assert destination.pois.count() == 2
    assert destination.cost_profile is not None
    assert destination.cost_profile.daily_budget_low == 80


def test_discover_destination_calls_firecrawl_and_persists_extracted_data(settings):
    settings.FIRECRAWL_API_KEY = "test-key"
    settings.FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1"

    extracted = {
        "name": "Lisboa",
        "country": "Portugal",
        "city": "Lisboa",
        "summary": "Capital de Portugal a beira do Tejo.",
        "best_season": "Primavera",
        "timezone": "Europe/Lisbon",
        "costs": {"low": 150, "mid": 280, "high": 520},
        "pois": [
            {
                "name": "Mosteiro dos Jeronimos",
                "type": "attraction",
                "tags": ["historia", "unesco"],
                "summary": "Joia manuelina em Belem.",
            },
            {
                "name": "Time Out Market",
                "type": "restaurant",
                "tags": ["gastronomia"],
                "summary": "Praca de alimentacao com chefs de Lisboa.",
            },
        ],
    }

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            return FakeResponse(
                200,
                _firecrawl_search_response(["https://visitlisboa.com/", "https://en.wikipedia.org/wiki/Lisbon"]),
            )
        if url.endswith("/scrape"):
            return FakeResponse(200, _firecrawl_scrape_response(extracted))
        raise AssertionError(f"Endpoint inesperado: {url}")

    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        destination = FirecrawlIngestionService().discover_destination(query="lisboa")

    assert destination is not None
    assert destination.slug == "lisboa"
    # name/country/city devem ter sido promovidos a partir do payload extraido
    assert destination.name == "Lisboa"
    assert destination.country == "Portugal"
    assert destination.city == "Lisboa"
    assert destination.summary.startswith("Capital de Portugal")
    assert destination.best_season == "Primavera"
    assert destination.timezone == "Europe/Lisbon"

    assert destination.cost_profile.daily_budget_low == 150
    assert destination.cost_profile.daily_budget_mid == 280

    pois = list(destination.pois.order_by("name").values_list("name", flat=True))
    assert pois == ["Mosteiro dos Jeronimos", "Time Out Market"]

    poi = PointOfInterest.objects.get(slug="mosteiro-dos-jeronimos")
    assert poi.poi_type == "attraction"
    assert set(poi.tags.values_list("slug", flat=True)) == {"historia", "unesco"}


def test_discover_destination_returns_none_when_search_returns_empty(settings):
    settings.FIRECRAWL_API_KEY = "test-key"

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            return FakeResponse(200, {"success": True, "data": []})
        raise AssertionError(f"Endpoint inesperado: {url}")

    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        destination = FirecrawlIngestionService().discover_destination(query="lugar-que-nao-existe")

    assert destination is None
    assert not Destination.objects.filter(slug="lugar-que-nao-existe").exists()


def test_discover_destination_handles_unauthorized_gracefully(settings, caplog):
    settings.FIRECRAWL_API_KEY = "bad-key"

    def fake_post(url, json=None, headers=None, timeout=None):
        return FakeResponse(401, {"success": False, "error": "Invalid API key"})

    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        destination = FirecrawlIngestionService().discover_destination(query="paris")

    assert destination is None


def test_request_maps_rate_limit_to_firecrawl_error(settings):
    settings.FIRECRAWL_API_KEY = "test-key"

    def fake_post(url, json=None, headers=None, timeout=None):
        return FakeResponse(429, {"success": False, "error": "rate limit"})

    service = FirecrawlIngestionService()
    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        with pytest.raises(FirecrawlError, match="429"):
            service._request("/search", {"query": "x"})
