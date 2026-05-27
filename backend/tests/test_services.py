from unittest.mock import patch

import pytest
from django.core.cache import cache

from apps.destinations.models import Destination, PointOfInterest
from apps.integrations.services import FirecrawlError, FirecrawlIngestionService


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


pytestmark = pytest.mark.django_db


def _firecrawl_search_response(urls: list[str]) -> dict:
    return {"success": True, "data": [{"url": u, "title": u} for u in urls]}


def _firecrawl_scrape_response(payload: dict) -> dict:
    return {"success": True, "data": {"json": payload}}


class FakeResponse:
    def __init__(self, status_code: int, body: dict):
        self.status_code = status_code
        self._body = body

    @property
    def text(self) -> str:
        import json as _json

        return _json.dumps(self._body)

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
        "hero_image_url": "https://cdn.example.com/lisboa-hero.jpg",
        "best_season": "Primavera",
        "timezone": "Europe/Lisbon",
        "costs": {"low": 150, "mid": 280, "high": 520},
        "pois": [
            {
                "name": "Mosteiro dos Jeronimos",
                "type": "attraction",
                "tags": ["historia", "unesco"],
                "summary": "Joia manuelina em Belem.",
                "image_url": "https://cdn.example.com/jeronimos.jpg",
            },
            {
                "name": "Time Out Market",
                "type": "restaurant",
                "tags": ["gastronomia"],
                "summary": "Praca de alimentacao com chefs de Lisboa.",
            },
            {
                "name": "Hotel Bairro Alto",
                "type": "Hotel",
                "tags": ["luxo"],
                "summary": "Vista panoramica do Tejo.",
                "image_url": "not-a-valid-url",
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
    assert destination.hero_image_url == "https://cdn.example.com/lisboa-hero.jpg"
    assert destination.metadata["extracted"]["hero_image_url"] == "https://cdn.example.com/lisboa-hero.jpg"

    assert destination.cost_profile.daily_budget_low == 150
    assert destination.cost_profile.daily_budget_mid == 280

    pois = list(destination.pois.order_by("name").values_list("name", flat=True))
    assert pois == ["Hotel Bairro Alto", "Mosteiro dos Jeronimos", "Time Out Market"]

    poi = PointOfInterest.objects.get(slug="mosteiro-dos-jeronimos")
    assert poi.poi_type == "attraction"
    assert set(poi.tags.values_list("slug", flat=True)) == {"historia", "unesco"}
    assert poi.metadata.get("image_url") == "https://cdn.example.com/jeronimos.jpg"

    hotel = PointOfInterest.objects.get(slug="hotel-bairro-alto")
    assert hotel.poi_type == "lodging"
    assert "image_url" not in hotel.metadata


def test_discover_destination_falls_back_to_wikipedia_when_search_empty(settings):
    """Se o /search nao retorna URLs, tenta pt.wikipedia.org/wiki/<slug>."""
    settings.FIRECRAWL_API_KEY = "test-key"

    captured = {"scrape_urls": []}

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            return FakeResponse(200, {"success": True, "data": []})
        if url.endswith("/scrape"):
            captured["scrape_urls"].append(json["url"])
            return FakeResponse(
                200,
                _firecrawl_scrape_response({
                    "name": "Iracemápolis",
                    "country": "Brasil",
                    "summary": "Municipio paulista conhecido por suas lagoas.",
                    "pois": [{"name": "Lagoa Azul", "type": "attraction"}],
                }),
            )
        raise AssertionError(f"Endpoint inesperado: {url}")

    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        destination = FirecrawlIngestionService().discover_destination(query="iracemapolis")

    assert destination is not None
    assert captured["scrape_urls"] == ["https://pt.wikipedia.org/wiki/iracemapolis"]
    assert destination.summary.startswith("Municipio paulista")


def test_discover_destination_returns_none_when_fallback_also_fails(settings):
    settings.FIRECRAWL_API_KEY = "test-key"

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            return FakeResponse(200, {"success": True, "data": []})
        if url.endswith("/scrape"):
            return FakeResponse(404, {"success": False, "error": "not found"})
        raise AssertionError(f"Endpoint inesperado: {url}")

    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        destination = FirecrawlIngestionService().discover_destination(query="lugar-que-nao-existe")

    assert destination is None
    assert not Destination.objects.filter(slug="lugar-que-nao-existe").exists()


def test_search_filters_unsupported_hosts(settings):
    """URLs de Instagram/YouTube/etc sao descartadas antes do scrape."""
    settings.FIRECRAWL_API_KEY = "test-key"

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            return FakeResponse(
                200,
                _firecrawl_search_response([
                    "https://www.instagram.com/guiacampinas/",
                    "https://www.youtube.com/watch?v=abc",
                    "https://en.wikipedia.org/wiki/Campinas",
                ]),
            )
        raise AssertionError(f"Endpoint inesperado: {url}")

    service = FirecrawlIngestionService()
    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        urls = service._search_urls("campinas")

    assert urls == ["https://en.wikipedia.org/wiki/Campinas"]


def test_discover_destination_falls_back_to_wikipedia_when_search_urls_all_fail(settings):
    """Search retorna URLs mas todas falham no scrape: tenta wikipedia como ultimo recurso."""
    settings.FIRECRAWL_API_KEY = "test-key"

    scrape_calls: list[str] = []
    wiki_payload = {
        "name": "Limeira",
        "country": "Brasil",
        "summary": "Cidade do interior paulista.",
        "pois": [{"name": "Catedral de Limeira", "type": "attraction"}],
    }

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            return FakeResponse(
                200,
                _firecrawl_search_response(["https://www.expedia.com/es/Limeira.dx181033"]),
            )
        if url.endswith("/scrape"):
            scrape_calls.append(json["url"])
            if "wikipedia.org" in json["url"]:
                return FakeResponse(200, _firecrawl_scrape_response(wiki_payload))
            return FakeResponse(500, {"success": False, "error": "timeout"})
        raise AssertionError(f"Endpoint inesperado: {url}")

    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        destination = FirecrawlIngestionService().discover_destination(query="limeira")

    assert destination is not None
    assert destination.summary.startswith("Cidade do interior")
    assert scrape_calls == [
        "https://www.expedia.com/es/Limeira.dx181033",
        "https://pt.wikipedia.org/wiki/limeira",
    ]


def test_discover_destination_returns_none_when_search_and_wiki_fallback_both_fail(settings):
    settings.FIRECRAWL_API_KEY = "test-key"

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            return FakeResponse(
                200,
                _firecrawl_search_response(["https://www.expedia.com/Limeira"]),
            )
        if url.endswith("/scrape"):
            return FakeResponse(500, {"success": False, "error": "timeout"})
        raise AssertionError(f"Endpoint inesperado: {url}")

    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        destination = FirecrawlIngestionService().discover_destination(query="cidade-perdida")

    assert destination is None
    assert not Destination.objects.filter(slug="cidade-perdida").exists()


def test_discover_destination_skips_firecrawl_when_recently_failed(settings):
    """Apos uma falha, a próxima busca dentro do TTL nao chama Firecrawl."""
    settings.FIRECRAWL_API_KEY = "test-key"
    settings.FIRECRAWL_DISCOVERY_FAILURE_TTL = 60

    call_count = {"search": 0}

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            call_count["search"] += 1
            return FakeResponse(200, {"success": True, "data": []})
        if url.endswith("/scrape"):
            return FakeResponse(500, {"success": False, "error": "timeout"})
        raise AssertionError(f"Endpoint inesperado: {url}")

    service = FirecrawlIngestionService()
    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        first = service.discover_destination(query="cidade-nada")
        second = service.discover_destination(query="cidade-nada")

    assert first is None
    assert second is None
    # Segunda chamada nao deve ter invocado /search nem /scrape
    assert call_count["search"] == 1


def test_discovery_failure_cache_disabled_when_ttl_zero(settings):
    settings.FIRECRAWL_API_KEY = "test-key"
    settings.FIRECRAWL_DISCOVERY_FAILURE_TTL = 0

    call_count = {"search": 0}

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            call_count["search"] += 1
            return FakeResponse(200, {"success": True, "data": []})
        if url.endswith("/scrape"):
            return FakeResponse(500, {"success": False, "error": "timeout"})
        raise AssertionError(f"Endpoint inesperado: {url}")

    service = FirecrawlIngestionService()
    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        service.discover_destination(query="cidade-nada")
        service.discover_destination(query="cidade-nada")

    assert call_count["search"] == 2


def test_search_query_includes_country(settings):
    """O argumento country e adicionado a query do /search."""
    settings.FIRECRAWL_API_KEY = "test-key"
    captured = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            captured["query"] = json["query"]
            return FakeResponse(200, {"success": True, "data": []})
        raise AssertionError(f"Endpoint inesperado: {url}")

    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        FirecrawlIngestionService()._search_urls("lisboa", country="Portugal")

    assert "Portugal" in captured["query"]
    assert "lisboa" in captured["query"]


def test_discover_destination_handles_unauthorized_gracefully(settings, caplog):
    settings.FIRECRAWL_API_KEY = "bad-key"

    def fake_post(url, json=None, headers=None, timeout=None):
        return FakeResponse(401, {"success": False, "error": "Invalid API key"})

    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        destination = FirecrawlIngestionService().discover_destination(query="paris")

    assert destination is None


def test_discover_destination_drops_placeholder_when_scrape_fails(settings):
    settings.FIRECRAWL_API_KEY = "test-key"

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            return FakeResponse(
                200,
                _firecrawl_search_response(["https://example.com/araras"]),
            )
        if url.endswith("/scrape"):
            return FakeResponse(500, {"success": False, "error": "upstream timeout"})
        raise AssertionError(f"Endpoint inesperado: {url}")

    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        destination = FirecrawlIngestionService().discover_destination(query="araras")

    assert destination is None
    assert not Destination.objects.filter(slug="araras").exists()


def test_discover_destination_drops_placeholder_when_scrape_returns_empty(settings):
    settings.FIRECRAWL_API_KEY = "test-key"

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            return FakeResponse(
                200,
                _firecrawl_search_response(["https://example.com/x"]),
            )
        if url.endswith("/scrape"):
            return FakeResponse(200, _firecrawl_scrape_response({}))
        raise AssertionError(f"Endpoint inesperado: {url}")

    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        destination = FirecrawlIngestionService().discover_destination(query="lugar-vazio")

    assert destination is None
    assert not Destination.objects.filter(slug="lugar-vazio").exists()


def test_request_maps_rate_limit_to_firecrawl_error(settings):
    settings.FIRECRAWL_API_KEY = "test-key"

    def fake_post(url, json=None, headers=None, timeout=None):
        return FakeResponse(429, {"success": False, "error": "rate limit"})

    service = FirecrawlIngestionService()
    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        with pytest.raises(FirecrawlError, match="429"):
            service._request("/search", {"query": "x"})


def test_discover_destination_tolerates_per_url_failure(settings):
    """Se uma URL falha mas outra retorna dados, persiste o que veio."""
    settings.FIRECRAWL_API_KEY = "test-key"

    good_payload = {
        "name": "Curitiba",
        "country": "Brasil",
        "city": "Curitiba",
        "summary": "Capital paranaense conhecida pelos parques.",
        "pois": [{"name": "Jardim Botanico", "type": "attraction"}],
    }
    call_count = {"scrape": 0}

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            return FakeResponse(
                200,
                _firecrawl_search_response([
                    "https://broken.example.com/curitiba",
                    "https://ok.example.com/curitiba",
                ]),
            )
        if url.endswith("/scrape"):
            call_count["scrape"] += 1
            if call_count["scrape"] == 1:
                return FakeResponse(500, {"success": False, "error": "scrape failed"})
            return FakeResponse(200, _firecrawl_scrape_response(good_payload))
        raise AssertionError(f"Endpoint inesperado: {url}")

    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        destination = FirecrawlIngestionService().discover_destination(query="curitiba")

    assert destination is not None
    assert destination.summary.startswith("Capital paranaense")
    assert destination.pois.count() == 1
    failures = destination.metadata.get("scrape_failures") or []
    assert len(failures) == 1
    assert "broken.example.com" in failures[0]["url"]


def test_aggregate_payloads_raises_when_all_urls_fail(settings):
    """Se todas as URLs falham, levanta FirecrawlError pra propagar o erro."""
    settings.FIRECRAWL_API_KEY = "test-key"

    def fake_post(url, json=None, headers=None, timeout=None):
        return FakeResponse(500, {"success": False, "error": "down"})

    service = FirecrawlIngestionService()
    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        with pytest.raises(FirecrawlError, match="Todas as 2 URLs"):
            service._aggregate_payloads(["https://a.example.com", "https://b.example.com"])


def test_aggregate_payloads_early_exits_after_first_complete_url(settings):
    """Para de scrapear assim que tem summary + pelo menos um POI."""
    settings.FIRECRAWL_API_KEY = "test-key"

    payload = {
        "summary": "Resumo completo",
        "pois": [{"name": "POI A", "type": "attraction"}],
    }
    scrape_calls: list[str] = []

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/scrape"):
            scrape_calls.append(json["url"])
            return FakeResponse(200, _firecrawl_scrape_response(payload))
        raise AssertionError(f"Endpoint inesperado: {url}")

    service = FirecrawlIngestionService()
    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        agg = service._aggregate_payloads([
            "https://first.example.com",
            "https://second.example.com",
            "https://third.example.com",
        ])

    assert scrape_calls == ["https://first.example.com"]
    assert agg.has_meaningful_data()
    assert len(agg.pois) == 1


def test_search_limit_uses_setting(settings):
    """O limite enviado no /search vem de FIRECRAWL_SEARCH_LIMIT."""
    settings.FIRECRAWL_API_KEY = "test-key"
    settings.FIRECRAWL_SEARCH_LIMIT = 5

    captured = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        if url.endswith("/search"):
            captured["limit"] = json["limit"]
            return FakeResponse(200, {"success": True, "data": []})
        raise AssertionError(f"Endpoint inesperado: {url}")

    with patch("apps.integrations.services.requests.post", side_effect=fake_post):
        FirecrawlIngestionService()._search_urls("teste")

    assert captured["limit"] == 5
