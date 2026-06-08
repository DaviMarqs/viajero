"""Orquestra Firecrawl + Gemini para descoberta paralela de destino."""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from urllib.parse import quote

import requests
from django.conf import settings
from django.db import transaction
from django.utils.text import slugify

from apps.ai.enrichers.base import EnrichmentResult
from apps.ai.enrichers.destination_gemini import GeminiDestinationEnricher
from apps.ai.enrichers.destination_groq import GroqDestinationEnricher
from apps.integrations.services import (
    AggregatedExtraction,
    FirecrawlError,
    FirecrawlIngestionService,
)

from .models import Destination


logger = logging.getLogger(__name__)

WIKIPEDIA_THUMBNAIL_TIMEOUT = 5
WIKIPEDIA_THUMBNAIL_LANGS = ("pt", "en")
WIKIPEDIA_HEADERS = {
    "User-Agent": "Viajero/1.0 (https://github.com/viajero; contact@viajero.app) python-requests",
}


def fetch_wikipedia_thumbnail(query: str, region: str = "") -> str:
    """Busca thumbnail publica da Wikipedia REST API. Sem chave.

    Quando `region` e informado, tenta primeiro o titulo desambiguado
    "{query} ({region})" (ex.: 'Formiga (Minas Gerais)') antes do nome cru —
    evita cair em pagina de desambiguacao/inseto. Tenta pt-br depois en.
    Retorna URL ou string vazia.
    """
    base = (query or "").strip()
    if not base:
        return ""

    candidates = []
    if region.strip():
        candidates.append(f"{base} ({region.strip()})")
    candidates.append(base)

    for candidate in candidates:
        title = quote(candidate.replace(" ", "_"))
        for lang in WIKIPEDIA_THUMBNAIL_LANGS:
            url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{title}"
            try:
                response = requests.get(url, headers=WIKIPEDIA_HEADERS, timeout=WIKIPEDIA_THUMBNAIL_TIMEOUT)
            except requests.RequestException:
                continue
            if response.status_code != 200:
                continue
            try:
                data = response.json()
            except ValueError:
                continue
            for key in ("originalimage", "thumbnail"):
                src = ((data.get(key) or {}).get("source") or "").strip()
                if src.startswith(("http://", "https://")):
                    return src[:500]
    return ""


class DestinationDiscoveryService:
    def __init__(self) -> None:
        self._firecrawl = FirecrawlIngestionService()

    def discover(
        self,
        *,
        query: str,
        country: str = "",
        city: str = "",
        region: str = "",
        actor=None,
    ) -> Destination | None:
        slug = slugify(query)[:50]
        if not slug:
            return None

        if self._firecrawl._is_recently_failed(slug):
            logger.info(
                "Pulando discovery para slug=%s (cache negativo, ttl=%ss)",
                slug, settings.FIRECRAWL_DISCOVERY_FAILURE_TTL,
            )
            return None

        firecrawl_result, llm_result = self._run_parallel(query, country, city)

        if firecrawl_result is None and not llm_result.has_meaningful_data():
            logger.info("Discovery sem dados uteis para slug=%s", slug)
            self._firecrawl._mark_recently_failed(slug)
            return None

        merged = self._merge(firecrawl_result, llm_result, query=query, country=country, city=city)
        if not merged["has_data"]:
            self._firecrawl._mark_recently_failed(slug)
            return None

        destination = self._persist(slug=slug, merged=merged, region=region, actor=actor)
        logger.info(
            "Destino descoberto: slug=%s sources=%s pois=%d",
            slug, merged["sources"], len(merged["pois"]),
        )
        return destination

    def _run_parallel(
        self, query: str, country: str, city: str,
    ) -> tuple[AggregatedExtraction | None, EnrichmentResult]:
        with ThreadPoolExecutor(max_workers=2) as pool:
            fc_future = pool.submit(self._run_firecrawl, query, country, city)
            llm_future = pool.submit(self._run_llm, query, country, city)
            return fc_future.result(), llm_future.result()

    def _run_firecrawl(self, query: str, country: str, city: str) -> AggregatedExtraction | None:
        if self._firecrawl.is_circuit_open():
            logger.info("Firecrawl circuit ABERTO, pulando para LLM (query=%s)", query)
            return None

        try:
            urls = self._firecrawl._search_urls(query, country=country)
        except FirecrawlError as exc:
            logger.warning("Firecrawl search falhou para query=%s: %s", query, exc)
            self._firecrawl.record_failure()
            urls = []

        wiki_fallback = self._firecrawl._wikipedia_fallback_url(query)
        if not urls:
            urls = [wiki_fallback]

        try:
            result = self._firecrawl._aggregate_payloads(urls)
            self._firecrawl.record_success()
            return result
        except FirecrawlError as exc:
            self._firecrawl.record_failure()
            if wiki_fallback in urls:
                logger.warning(
                    "Firecrawl falhou em todas as URLs (incluindo wiki) para query=%s: %s",
                    query, exc,
                )
                return None
            logger.info(
                "Firecrawl falhou em todas as %d URLs para query=%s, tentando wikipedia",
                len(urls), query,
            )
            try:
                result = self._firecrawl._aggregate_payloads([wiki_fallback])
                self._firecrawl.record_success()
                return result
            except FirecrawlError as exc2:
                self._firecrawl.record_failure()
                logger.warning(
                    "Fallback wikipedia tambem falhou para query=%s: %s", query, exc2,
                )
                return None

    def _run_llm(self, query: str, country: str, city: str) -> EnrichmentResult:
        """Tenta Gemini primeiro; se falhar ou vier vazio, cai pra Groq."""
        if settings.GEMINI_API_KEY:
            try:
                result = GeminiDestinationEnricher().enrich(
                    query=query, country=country, city=city,
                )
                if result.has_meaningful_data():
                    return result
                logger.info(
                    "Gemini sem dados uteis para query=%s, tentando Groq fallback", query,
                )
            except Exception:
                logger.exception(
                    "Gemini enricher falhou para query=%s, tentando Groq fallback", query,
                )

        if settings.GROQ_API_KEY:
            try:
                return GroqDestinationEnricher().enrich(
                    query=query, country=country, city=city,
                )
            except Exception:
                logger.exception("Groq enricher falhou para query=%s", query)

        return EnrichmentResult()

    def _merge(
        self,
        firecrawl: AggregatedExtraction | None,
        llm: EnrichmentResult,
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
            return str(fc_meta.get(key) or getattr(llm, key, "") or "")

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
        for poi in llm.pois:
            poi_slug = slugify(poi.get("name") or "")
            if not poi_slug or poi_slug in existing_slugs:
                continue
            merged_pois.append(poi)
            existing_slugs.add(poi_slug)

        llm_source = llm.metadata.get("source", "")
        sources = {
            "firecrawl": firecrawl is not None,
            "gemini": llm.has_meaningful_data() and llm_source == "gemini",
            "groq": llm.has_meaningful_data() and llm_source == "groq",
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
            "llm_source": llm_source,
            "llm_model": llm.metadata.get("model", ""),
            "has_data": has_data,
        }

    @transaction.atomic
    def _persist(self, *, slug: str, merged: dict[str, Any], region: str = "", actor=None) -> Destination:
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

        # Fallback de imagem: se nenhum scrape trouxe hero_image_url, busca thumbnail Wikipedia.
        destination.refresh_from_db()
        if not destination.hero_image_url:
            thumb = fetch_wikipedia_thumbnail(destination.name, region=region)
            if not thumb:
                thumb = fetch_wikipedia_thumbnail(merged["name"], region=region)
            if thumb:
                destination.hero_image_url = thumb
                destination.save(update_fields=["hero_image_url", "updated_at"])
                logger.info("Hero image fallback wikipedia aplicado: slug=%s url=%s", destination.slug, thumb[:80])

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
        if merged["llm_model"]:
            new_meta["llm_model"] = merged["llm_model"]
        if merged["llm_source"]:
            new_meta["llm_source"] = merged["llm_source"]
        destination.metadata = new_meta
        updates.append("metadata")

        destination.save(update_fields=list(set(updates)))

        if created:
            self._firecrawl._promote_extracted_fields(destination, placeholder_name=merged["name"][:150])
        return destination
