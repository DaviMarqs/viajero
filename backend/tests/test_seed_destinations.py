from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command

from apps.destinations.models import Destination


pytestmark = pytest.mark.django_db


def _make_destination(slug: str, **overrides) -> Destination:
    defaults = {
        "slug": slug,
        "name": slug.replace("-", " ").title(),
        "country": "Brasil",
        "city": "",
        "summary": "Resumo existente.",
    }
    defaults.update(overrides)
    return Destination.objects.create(**defaults)


def test_seed_creates_new_destinations_via_firecrawl():
    out = StringIO()

    def fake_discover(*, query, country, **_):
        dest, _ = Destination.objects.get_or_create(
            slug=query.lower().replace(" ", "-"),
            defaults={
                "name": query.title(),
                "country": country,
                "summary": f"Resumo gerado para {query}.",
            },
        )
        return dest

    with patch(
        "apps.destinations.management.commands.seed_destinations.FirecrawlIngestionService.discover_destination",
        side_effect=fake_discover,
    ):
        call_command(
            "seed_destinations",
            "--cities", "Bonito", "Paraty",
            "--delay", "0",
            stdout=out,
        )

    output = out.getvalue()
    assert "Bonito" in output
    assert "Paraty" in output
    assert "Criados:    2" in output
    assert Destination.objects.filter(slug="bonito").exists()
    assert Destination.objects.filter(slug="paraty").exists()


def test_seed_skips_already_populated_destinations():
    _make_destination("rio-de-janeiro")
    out = StringIO()

    discover = "apps.destinations.management.commands.seed_destinations.FirecrawlIngestionService.discover_destination"
    with patch(discover) as mock_discover:
        call_command(
            "seed_destinations",
            "--cities", "Rio de Janeiro",
            "--delay", "0",
            stdout=out,
        )
        mock_discover.assert_not_called()

    output = out.getvalue()
    assert "ja populado" in output
    assert "Pulados:    1" in output


def test_seed_force_re_ingests_existing_destinations():
    _make_destination("salvador")
    out = StringIO()

    def fake_discover(*, query, country, **_):
        return Destination.objects.get(slug="salvador")

    with patch(
        "apps.destinations.management.commands.seed_destinations.FirecrawlIngestionService.discover_destination",
        side_effect=fake_discover,
    ) as mock_discover:
        call_command(
            "seed_destinations",
            "--cities", "Salvador",
            "--force",
            "--delay", "0",
            stdout=out,
        )
        mock_discover.assert_called_once()

    assert "Atualizados: 1" in out.getvalue()


def test_seed_reports_failures_without_stopping():
    out = StringIO()
    sequence = iter([None, "OK"])

    def fake_discover(*, query, country, **_):
        result = next(sequence)
        if result is None:
            return None
        dest, _ = Destination.objects.get_or_create(
            slug=query.lower().replace(" ", "-"),
            defaults={"name": query.title(), "country": country, "summary": "OK."},
        )
        return dest

    with patch(
        "apps.destinations.management.commands.seed_destinations.FirecrawlIngestionService.discover_destination",
        side_effect=fake_discover,
    ):
        call_command(
            "seed_destinations",
            "--cities", "Cidade Ruim", "Cidade Boa",
            "--delay", "0",
            stdout=out,
        )

    output = out.getvalue()
    assert "Cidade Ruim" in output
    assert "Cidade Boa" in output
    assert "Falhas:     1" in output
    assert "Criados:    1" in output
