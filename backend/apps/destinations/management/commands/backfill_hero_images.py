"""Preenche `hero_image_url` ausente em destinos existentes via Wikipedia."""
from __future__ import annotations

import time

from django.core.management.base import BaseCommand

from apps.destinations.models import Destination
from apps.destinations.services import fetch_wikipedia_thumbnail


class Command(BaseCommand):
    help = "Preenche hero_image_url ausente buscando thumbnail na Wikipedia (pt → en)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--delay",
            type=float,
            default=0.5,
            help="Segundos entre cidades (default 0.5).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Sobrescreve mesmo destinos que ja tem hero_image_url.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Limita a N destinos (0 = sem limite).",
        )

    def handle(self, *args, **options):
        delay = options["delay"]
        force = options["force"]
        limit = options["limit"]

        queryset = Destination.objects.all()
        if not force:
            queryset = queryset.filter(hero_image_url="")
        queryset = queryset.order_by("slug")
        if limit:
            queryset = queryset[:limit]

        total = queryset.count()
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"Backfill de hero_image_url para {total} destino(s) (force={force})"
        ))

        stats = {"ok": 0, "fail": 0}
        for index, destination in enumerate(queryset, start=1):
            prefix = f"[{index}/{total}] {destination.slug}"
            url = fetch_wikipedia_thumbnail(destination.name)
            if not url:
                self.stdout.write(self.style.WARNING(f"{prefix} -> Wikipedia sem thumbnail"))
                stats["fail"] += 1
            else:
                destination.hero_image_url = url
                destination.save(update_fields=["hero_image_url", "updated_at"])
                self.stdout.write(self.style.SUCCESS(f"{prefix} -> ok ({url[:60]}...)"))
                stats["ok"] += 1
            if delay > 0:
                time.sleep(delay)

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Resumo"))
        self.stdout.write(self.style.SUCCESS(f"  Preenchidos: {stats['ok']}"))
        self.stdout.write(f"  Falhas:      {stats['fail']}")
