from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache

from apps.ai.enrichers.base import EnrichmentResult
from apps.destinations.models import Destination
from apps.destinations.services import DestinationDiscoveryService
from apps.integrations.services import (
    AggregatedExtraction,
    FirecrawlError,
    FirecrawlIngestionService,
)


pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


def _firecrawl_aggregated(summary: str, pois: list[dict]) -> AggregatedExtraction:
    return AggregatedExtraction(
        source_urls=["https://example.com/x"],
        extracted_meta={"summary": summary},
        pois=pois,
    )


def _gemini_result(summary: str, pois: list[dict]) -> EnrichmentResult:
    return EnrichmentResult(summary=summary, pois=pois, metadata={"source": "gemini"})


def test_discover_merges_firecrawl_and_gemini_data(settings):
    settings.GEMINI_API_KEY = "fake"
    settings.FIRECRAWL_API_KEY = "fake"

    fc_pois = [{"name": "Praia Central", "type": "attraction", "tags": ["natureza"]}]
    g_pois = [{"name": "Mercado Municipal", "type": "restaurant", "source": "gemini"}]

    with patch.object(
        FirecrawlIngestionService,
        "_search_urls",
        return_value=["https://example.com/x"],
    ), patch.object(
        FirecrawlIngestionService,
        "_aggregate_payloads",
        return_value=_firecrawl_aggregated("Resumo do Firecrawl", fc_pois),
    ), patch(
        "apps.destinations.services.GeminiDestinationEnricher",
    ) as enricher_cls:
        enricher_cls.return_value.enrich.return_value = _gemini_result(
            "Resumo do Gemini", g_pois,
        )
        destination = DestinationDiscoveryService().discover(
            query="Florianopolis", country="Brasil", city="", actor=None,
        )

    assert destination is not None
    assert destination.summary == "Resumo do Firecrawl"  # Firecrawl > Gemini
    poi_names = set(destination.pois.values_list("name", flat=True))
    assert {"Praia Central", "Mercado Municipal"} <= poi_names
    sources = destination.metadata.get("sources") or {}
    assert sources == {"firecrawl": True, "gemini": True, "groq": False}

    mercado = destination.pois.get(name="Mercado Municipal")
    assert mercado.metadata.get("source") == "gemini"
    praia = destination.pois.get(name="Praia Central")
    assert praia.metadata.get("source") != "gemini"  # POI do Firecrawl, sem marca


def test_discover_dedup_pois_by_slug_firecrawl_wins(settings):
    settings.GEMINI_API_KEY = "fake"
    settings.FIRECRAWL_API_KEY = "fake"

    fc_pois = [{"name": "Praia Central", "type": "attraction"}]
    g_pois = [{"name": "Praia Central", "type": "restaurant", "source": "gemini"}]  # mesmo slug

    with patch.object(
        FirecrawlIngestionService, "_search_urls", return_value=["https://x"],
    ), patch.object(
        FirecrawlIngestionService,
        "_aggregate_payloads",
        return_value=_firecrawl_aggregated("Resumo", fc_pois),
    ), patch(
        "apps.destinations.services.GeminiDestinationEnricher",
    ) as enricher_cls:
        enricher_cls.return_value.enrich.return_value = _gemini_result("ignorar", g_pois)
        destination = DestinationDiscoveryService().discover(
            query="X", country="", city="", actor=None,
        )

    poi = destination.pois.get(slug="praia-central")
    assert poi.poi_type == "attraction"  # Firecrawl venceu o dedup (update_or_create com dados Firecrawl primeiro)
    # Firecrawl venceu: metadata nao deve ter source=gemini, pois o POI foi persistido antes do Gemini tentar sobrescrever
    assert poi.metadata.get("source") != "gemini"


def test_discover_uses_gemini_when_firecrawl_fails(settings):
    settings.GEMINI_API_KEY = "fake"
    settings.FIRECRAWL_API_KEY = "fake"

    g_pois = [{"name": "Cachoeira", "type": "attraction", "source": "gemini"}]

    with patch.object(
        FirecrawlIngestionService,
        "_search_urls",
        side_effect=FirecrawlError("search down"),
    ), patch.object(
        FirecrawlIngestionService,
        "_aggregate_payloads",
        side_effect=FirecrawlError("all urls failed"),
    ), patch(
        "apps.destinations.services.GeminiDestinationEnricher",
    ) as enricher_cls:
        enricher_cls.return_value.enrich.return_value = _gemini_result(
            "So o Gemini respondeu", g_pois,
        )
        destination = DestinationDiscoveryService().discover(
            query="LugarMisterioso", country="", city="", actor=None,
        )

    assert destination is not None
    assert destination.summary == "So o Gemini respondeu"
    sources = destination.metadata.get("sources") or {}
    assert sources == {"firecrawl": False, "gemini": True, "groq": False}

    # POIs do Gemini devem ter metadata.source=gemini persistido
    poi = destination.pois.get(name="Cachoeira")
    assert poi.metadata.get("source") == "gemini"


def test_discover_returns_none_when_both_fail(settings):
    settings.GEMINI_API_KEY = "fake"
    settings.FIRECRAWL_API_KEY = "fake"
    settings.FIRECRAWL_DISCOVERY_FAILURE_TTL = 60

    with patch.object(
        FirecrawlIngestionService,
        "_search_urls",
        side_effect=FirecrawlError("down"),
    ), patch(
        "apps.destinations.services.GeminiDestinationEnricher",
    ) as enricher_cls:
        enricher_cls.return_value.enrich.return_value = EnrichmentResult()

        service = DestinationDiscoveryService()
        first = service.discover(query="Fantasma", country="", city="", actor=None)
        # 2a chamada nao deve disparar nem Firecrawl nem Gemini (cache)
        enricher_cls.return_value.enrich.reset_mock()
        second = service.discover(query="Fantasma", country="", city="", actor=None)

    assert first is None
    assert second is None
    assert not Destination.objects.filter(slug="fantasma").exists()
    enricher_cls.return_value.enrich.assert_not_called()


def test_discover_skips_gemini_when_key_missing(settings):
    settings.GEMINI_API_KEY = ""
    settings.FIRECRAWL_API_KEY = "fake"

    fc_pois = [{"name": "POI", "type": "attraction"}]

    with patch.object(
        FirecrawlIngestionService, "_search_urls", return_value=["https://x"],
    ), patch.object(
        FirecrawlIngestionService,
        "_aggregate_payloads",
        return_value=_firecrawl_aggregated("Resumo", fc_pois),
    ), patch(
        "apps.destinations.services.GeminiDestinationEnricher",
    ) as enricher_cls:
        destination = DestinationDiscoveryService().discover(
            query="X", country="", city="", actor=None,
        )

    enricher_cls.assert_not_called()
    sources = destination.metadata.get("sources") or {}
    assert sources == {"firecrawl": True, "gemini": False, "groq": False}


def test_discover_passes_region_to_wikipedia_thumbnail(settings):
    """discover(region=...) repassa a regiao para o fallback de imagem,
    evitando thumbnail ambigua (ex.: Formiga inseto)."""
    settings.GEMINI_API_KEY = ""
    settings.FIRECRAWL_API_KEY = "fake"

    fc_pois = [{"name": "Centro", "type": "attraction"}]

    with patch.object(
        FirecrawlIngestionService, "_search_urls", return_value=["https://x"],
    ), patch.object(
        FirecrawlIngestionService,
        "_aggregate_payloads",
        return_value=_firecrawl_aggregated("Resumo de Formiga", fc_pois),
    ), patch(
        "apps.destinations.services.GeminiDestinationEnricher",
    ), patch(
        "apps.destinations.services.fetch_wikipedia_thumbnail",
        return_value="https://upload.wikimedia.org/formiga.jpg",
    ) as thumb:
        destination = DestinationDiscoveryService().discover(
            query="Formiga", country="Brasil", city="Formiga",
            region="Minas Gerais", actor=None,
        )

    assert destination.hero_image_url == "https://upload.wikimedia.org/formiga.jpg"
    assert thumb.call_args.kwargs.get("region") == "Minas Gerais"
