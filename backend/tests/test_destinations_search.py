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
    cria via discover mas o _local_search por icontains nao casa em
    SQLite. O response deve conter o destino mesmo assim.
    """
    accented = _make_destination()

    with patch(
        "apps.destinations.views.DestinationDiscoveryService",
    ) as service_cls:
        service_cls.return_value.discover.return_value = accented
        client = APIClient()
        response = client.get("/api/destinations/search/?q=Sao Paulo")

    assert response.status_code == 200
    body = response.json()
    slugs = [item["slug"] for item in body["data"]]
    assert "sao-paulo" in slugs
    assert "enriquecido" in body["message"]


def test_search_skips_discovery_when_local_results_exist():
    _make_destination(slug="paris", name="Paris", country="Franca", city="Paris", summary="")

    with patch(
        "apps.destinations.views.DestinationDiscoveryService",
    ) as service_cls:
        client = APIClient()
        response = client.get("/api/destinations/search/?q=Paris")

    assert response.status_code == 200
    service_cls.return_value.discover.assert_not_called()
    body = response.json()
    assert any(item["slug"] == "paris" for item in body["data"])


def test_search_returns_empty_when_discover_returns_none():
    with patch(
        "apps.destinations.views.DestinationDiscoveryService",
    ) as service_cls:
        service_cls.return_value.discover.return_value = None
        client = APIClient()
        response = client.get("/api/destinations/search/?q=lugar-inexistente")

    assert response.status_code == 200
    body = response.json()
    assert body["data"] == []
    assert "enriquecido" not in body["message"]


def test_search_uses_discovery_service():
    """Confirma que view chama DestinationDiscoveryService, nao FirecrawlIngestionService direto."""
    destination = Destination.objects.create(
        slug="bonito",
        name="Bonito",
        country="Brasil",
        summary="resumo via discovery",
    )

    # Usa uma query sem acento que nao bate em icontains com 'Bonito' (SQLite nao ignora acento),
    # mas DestinationDiscoveryService retorna o destino ja existente.
    with patch(
        "apps.destinations.views.DestinationDiscoveryService",
    ) as service_cls:
        service_cls.return_value.discover.return_value = destination
        client = APIClient()
        response = client.get("/api/destinations/search/?q=destino-inexistente-xyz")

    service_cls.return_value.discover.assert_called_once()
    assert response.status_code == 200
    slugs = [item["slug"] for item in response.json()["data"]]
    assert "bonito" in slugs


def _resolved(**overrides):
    from apps.ai.resolvers.destination_resolver import ResolvedDestination
    defaults = {
        "name": "Tóquio", "country": "Japão", "city": "Tóquio",
        "region": "Kanto", "is_place": True, "confidence": 0.95,
    }
    defaults.update(overrides)
    return ResolvedDestination(**defaults)


def test_search_rejects_non_place_query():
    with patch(
        "apps.destinations.views.DestinationResolverService",
    ) as resolver_cls, patch(
        "apps.destinations.views.DestinationDiscoveryService",
    ) as discovery_cls:
        resolver_cls.return_value.resolve.return_value = _resolved(
            name="", country="", city="", region="",
            is_place=False, confidence=0.1,
        )
        client = APIClient()
        response = client.get("/api/destinations/search/?q=asdfgh")

    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    discovery_cls.return_value.discover.assert_not_called()


def test_search_uses_resolved_params_for_discovery():
    """Tokyo resolve para Japao; discover recebe pais/regiao corretos, nao Brasil."""
    with patch(
        "apps.destinations.views.DestinationResolverService",
    ) as resolver_cls, patch(
        "apps.destinations.views.DestinationDiscoveryService",
    ) as discovery_cls:
        resolver_cls.return_value.resolve.return_value = _resolved()
        discovery_cls.return_value.discover.return_value = _make_destination(
            slug="toquio", name="Tóquio", country="Japão", city="Tóquio",
        )
        client = APIClient()
        response = client.get("/api/destinations/search/?q=Tokyo")

    assert response.status_code == 200
    kwargs = discovery_cls.return_value.discover.call_args.kwargs
    assert kwargs["country"] == "Japão"
    assert kwargs["region"] == "Kanto"
    assert kwargs["query"] == "Tóquio"


def test_search_fails_open_when_resolver_returns_none():
    """Resolver indisponivel (Groq down) -> busca segue com a query crua."""
    with patch(
        "apps.destinations.views.DestinationResolverService",
    ) as resolver_cls, patch(
        "apps.destinations.views.DestinationDiscoveryService",
    ) as discovery_cls:
        resolver_cls.return_value.resolve.return_value = None
        discovery_cls.return_value.discover.return_value = None
        client = APIClient()
        response = client.get("/api/destinations/search/?q=lugar-novo")

    assert response.status_code == 200
    kwargs = discovery_cls.return_value.discover.call_args.kwargs
    assert kwargs["query"] == "lugar-novo"
    assert kwargs["region"] == ""
