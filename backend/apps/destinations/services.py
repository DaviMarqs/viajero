"""Orquestra Firecrawl + Gemini para descoberta paralela de destino."""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils.text import slugify

from apps.ai.enrichers.base import EnrichmentResult
from apps.ai.enrichers.destination_gemini import GeminiDestinationEnricher
from apps.integrations.services import (
    AggregatedExtraction,
    FirecrawlError,
    FirecrawlIngestionService,
)

from .models import Destination


logger = logging.getLogger(__name__)


class DestinationDiscoveryService:
    def __init__(self) -> None:
        self._firecrawl = FirecrawlIngestionService()

    def discover(
        self,
        *,
        query: str,
        country: str = "",
        city: str = "",
        actor=None,
    ) -> Destination | None:
        slug = slugify(query)
        if not slug:
            return None

        if self._firecrawl._is_recently_failed(slug):
            logger.info(
                "Pulando discovery para slug=%s (cache negativo, ttl=%ss)",
                slug, settings.FIRECRAWL_DISCOVERY_FAILURE_TTL,
            )
            return None

        firecrawl_result, gemini_result = self._run_parallel(query, country, city)

        if firecrawl_result is None and not gemini_result.has_meaningful_data():
            logger.info("Discovery sem dados uteis para slug=%s", slug)
            self._firecrawl._mark_recently_failed(slug)
            return None

        merged = self._merge(firecrawl_result, gemini_result, query=query, country=country, city=city)
        if not merged["has_data"]:
            self._firecrawl._mark_recently_failed(slug)
            return None

        return self._persist(slug=slug, merged=merged, actor=actor)

    def _run_parallel(
        self, query: str, country: str, city: str,
    ) -> tuple[AggregatedExtraction | None, EnrichmentResult]:
        with ThreadPoolExecutor(max_workers=2) as pool:
            fc_future = pool.submit(self._run_firecrawl, query, country, city)
            g_future = pool.submit(self._run_gemini, query, country, city)
            return fc_future.result(), g_future.result()

    def _run_firecrawl(self, query: str, country: str, city: str) -> AggregatedExtraction | None:
        try:
            urls = self._firecrawl._search_urls(query, country=country)
        except FirecrawlError:
            logger.exception("Firecrawl search falhou para query=%s", query)
            urls = []

        wiki_fallback = self._firecrawl._wikipedia_fallback_url(query)
        if not urls:
            urls = [wiki_fallback]

        try:
            return self._firecrawl._aggregate_payloads(urls)
        except FirecrawlError:
            if wiki_fallback in urls:
                logger.exception(
                    "Firecrawl falhou em todas as URLs (incluindo wiki) para query=%s", query,
                )
                return None
            logger.warning(
                "Firecrawl falhou em todas as %d URLs para query=%s, tentando wikipedia",
                len(urls), query,
            )
            try:
                return self._firecrawl._aggregate_payloads([wiki_fallback])
            except FirecrawlError:
                logger.exception("Fallback wikipedia tambem falhou para query=%s", query)
                return None

    def _run_gemini(self, query: str, country: str, city: str) -> EnrichmentResult:
        if not settings.GEMINI_API_KEY:
            return EnrichmentResult()
        try:
            return GeminiDestinationEnricher().enrich(query=query, country=country, city=city)
        except Exception:
            logger.exception("Gemini enricher falhou para query=%s", query)
            return EnrichmentResult()

    def _merge(
        self,
        firecrawl: AggregatedExtraction | None,
        gemini: EnrichmentResult,
        *,
        query: str,
        country: str,
        city: str,
    ) -> dict[str, Any]:
        fc_meta = firecrawl.extracted_meta if firecrawl else {}
        fc_pois = list(firecrawl.pois) if firecrawl else []
        fc_costs = firecrawl.costs if firecrawl else None
        fc_urls = list(firecrawl.source_urls) if firecrawl else []
        fc_failures = list(firecrawl.failures) if firecrawl else []

        def pick(key: str) -> str:
            return str(fc_meta.get(key) or getattr(gemini, key, "") or "")

        name = pick("name") or query.strip().title()
        country_val = pick("country") or country or "Desconhecido"
        city_val = pick("city") or city

        summary = pick("summary")
        best_season = pick("best_season")
        timezone = pick("timezone")
        hero = (fc_meta.get("hero_image_url") or "").strip()

        # Dedup POIs por slug — Firecrawl tem prioridade
        merged_pois = list(fc_pois)
        existing_slugs = {slugify(p.get("name") or "") for p in merged_pois}
        for poi in gemini.pois:
            poi_slug = slugify(poi.get("name") or "")
            if not poi_slug or poi_slug in existing_slugs:
                continue
            merged_pois.append(poi)
            existing_slugs.add(poi_slug)

        sources = {
            "firecrawl": firecrawl is not None,
            "gemini": gemini.has_meaningful_data(),
        }

        has_data = bool(summary) or bool(merged_pois)

        return {
            "name": name,
            "country": country_val,
            "city": city_val,
            "summary": summary,
            "best_season": best_season,
            "timezone": timezone,
            "hero_image_url": hero,
            "pois": merged_pois,
            "costs": fc_costs,
            "source_urls": fc_urls,
            "extracted_meta": fc_meta,
            "scrape_failures": fc_failures,
            "sources": sources,
            "gemini_model": gemini.metadata.get("model", ""),
            "has_data": has_data,
        }

    @transaction.atomic
    def _persist(self, *, slug: str, merged: dict[str, Any], actor) -> Destination:
        destination, created = Destination.objects.get_or_create(
            slug=slug,
            defaults={
                "name": merged["name"][:150],
                "country": merged["country"][:100],
                "city": (merged["city"] or "")[:100],
                "created_by": actor if actor and getattr(actor, "is_authenticated", False) else None,
            },
        )

        # Reusa o persist_extraction do Firecrawl injetando AggregatedExtraction com merged data
        aggregated = AggregatedExtraction(
            source_urls=merged["source_urls"],
            extracted_meta=merged["extracted_meta"],
            pois=merged["pois"],
            costs=merged["costs"],
            failures=merged["scrape_failures"],
        )
        self._firecrawl._persist_extraction(
            destination=destination,
            source_urls=merged["source_urls"],
            aggregated=aggregated,
        )

        # Pos-processar: campos que vem so do Gemini
        updates: list[str] = []
        if merged["summary"] and not destination.summary:
            destination.summary = merged["summary"][:4000]
            updates.append("summary")
        if merged["best_season"] and not destination.best_season:
            destination.best_season = merged["best_season"][:120]
            updates.append("best_season")
        if merged["timezone"] and not destination.timezone:
            destination.timezone = merged["timezone"][:64]
            updates.append("timezone")

        existing_meta = destination.metadata if isinstance(destination.metadata, dict) else {}
        new_meta = {
            **existing_meta,
            "sources": merged["sources"],
        }
        if merged["gemini_model"]:
            new_meta["gemini_model"] = merged["gemini_model"]
        destination.metadata = new_meta
        updates.append("metadata")

        destination.save(update_fields=list(set(updates)))

        if created:
            self._firecrawl._promote_extracted_fields(destination, placeholder_name=merged["name"][:150])
        return destination
