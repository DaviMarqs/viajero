"""Popula destinos via Firecrawl pra ter dados prontos pro frontend.

Uso:
    # Lista curada default (cidades brasileiras populares pra viagem)
    python manage.py seed_destinations

    # Cidades especificas
    python manage.py seed_destinations --cities "Lisboa" "Porto" "Madrid" --country Portugal

    # Re-ingerir mesmo se ja existe
    python manage.py seed_destinations --force

    # Limpar cache negativo antes (re-tentar slugs que falharam recentemente)
    python manage.py seed_destinations --clear-failure-cache

    # Ajustar intervalo entre chamadas (gentil com o Firecrawl)
    python manage.py seed_destinations --delay 2
"""

from __future__ import annotations

import time

from django.core.cache import cache
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.destinations.models import Destination
from apps.integrations.services import FirecrawlIngestionService


DEFAULT_CITIES = [
    "Rio de Janeiro",
    "Sao Paulo",
    "Salvador",
    "Florianopolis",
    "Brasilia",
    "Recife",
    "Fortaleza",
    "Manaus",
    "Curitiba",
    "Belo Horizonte",
    "Porto Alegre",
    "Natal",
    "Buzios",
    "Gramado",
    "Foz do Iguacu",
    "Bonito",
    "Jericoacoara",
    "Paraty",
    "Lencois Maranhenses",
    "Chapada Diamantina",
]


class Command(BaseCommand):
    help = "Popula a tabela de destinos via Firecrawl com uma lista curada de cidades."

    def add_arguments(self, parser):
        parser.add_argument(
            "--cities",
            nargs="+",
            help="Lista de cidades a popular. Default: lista curada de cidades brasileiras.",
        )
        parser.add_argument(
            "--country",
            default="Brasil",
            help="Pais usado na query e como fallback (default: Brasil).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-ingerir mesmo destinos que ja existem com dados.",
        )
        parser.add_argument(
            "--clear-failure-cache",
            action="store_true",
            help="Limpa o cache negativo antes de comecar (re-tenta slugs que falharam recentemente).",
        )
        parser.add_argument(
            "--delay",
            type=float,
            default=1.0,
            help="Segundos de espera entre cada cidade (default 1.0, pra nao sobrecarregar o Firecrawl).",
        )

    def handle(self, *args, **options):
        cities: list[str] = options.get("cities") or DEFAULT_CITIES
        country: str = options["country"]
        force: bool = options["force"]
        delay: float = options["delay"]

        if options["clear_failure_cache"]:
            self._clear_failure_cache(cities)

        service = FirecrawlIngestionService()
        stats = {"created": 0, "updated": 0, "skipped": 0, "failed": 0}
        total = len(cities)

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"Populando {total} destino(s) (country={country}, force={force}, delay={delay}s)"
        ))

        for index, city in enumerate(cities, start=1):
            prefix = f"[{index}/{total}] {city}"
            slug = slugify(city)

            if not force and self._already_populated(slug):
                self.stdout.write(f"{prefix} -> ja populado, pulando (use --force pra re-ingerir)")
                stats["skipped"] += 1
                continue

            existed_before = Destination.objects.filter(slug=slug).exists()

            try:
                destination = service.discover_destination(
                    query=city,
                    country=country,
                )
            except Exception as exc:
                self.stdout.write(self.style.ERROR(f"{prefix} -> erro inesperado: {exc}"))
                stats["failed"] += 1
                self._sleep(delay)
                continue

            if destination is None:
                self.stdout.write(self.style.WARNING(
                    f"{prefix} -> Firecrawl nao retornou dados uteis"
                ))
                stats["failed"] += 1
            else:
                pois = destination.pois.count()
                has_hero = bool(destination.hero_image_url)
                summary_len = len(destination.summary or "")
                action = "atualizado" if existed_before else "criado"
                self.stdout.write(self.style.SUCCESS(
                    f"{prefix} -> {action} (pois={pois}, hero={'ok' if has_hero else '-'}, "
                    f"summary={summary_len}c)"
                ))
                if existed_before:
                    stats["updated"] += 1
                else:
                    stats["created"] += 1

            self._sleep(delay)

        self._print_summary(stats, total)

    def _already_populated(self, slug: str) -> bool:
        return Destination.objects.filter(slug=slug).exclude(summary="").exists()

    def _clear_failure_cache(self, cities: list[str]) -> None:
        cleared = 0
        for city in cities:
            slug = slugify(city)
            if cache.delete(FirecrawlIngestionService._failure_cache_key(slug)):
                cleared += 1
        if cleared:
            self.stdout.write(f"Cache negativo limpo para {cleared} slug(s)")

    def _sleep(self, delay: float) -> None:
        if delay > 0:
            time.sleep(delay)

    def _print_summary(self, stats: dict, total: int) -> None:
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Resumo"))
        self.stdout.write(self.style.SUCCESS(f"  Criados:    {stats['created']}"))
        self.stdout.write(self.style.SUCCESS(f"  Atualizados: {stats['updated']}"))
        self.stdout.write(f"  Pulados:    {stats['skipped']}")
        if stats["failed"]:
            self.stdout.write(self.style.ERROR(f"  Falhas:     {stats['failed']}"))
        else:
            self.stdout.write(f"  Falhas:     {stats['failed']}")
        self.stdout.write(f"  Total:      {total}")
