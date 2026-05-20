from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import requests
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils.text import slugify

from apps.destinations.models import Destination, DestinationCostProfile, POITag, PointOfInterest


logger = logging.getLogger(__name__)


VALID_POI_TYPES = {"attraction", "restaurant", "activity", "lodging"}

# Dominios que o Firecrawl recusa (HTTP 403 "we do not support this site") ou
# que retornam pouco conteudo util para extracao de guia turistico.
UNSUPPORTED_SEARCH_HOSTS = (
    "instagram.com",
    "facebook.com",
    "fb.com",
    "youtube.com",
    "youtu.be",
    "tiktok.com",
    "x.com",
    "twitter.com",
    "linkedin.com",
    "reddit.com",
    "pinterest.com",
    "threads.net",
)

POI_TYPE_ALIASES = {
    "hotel": "lodging",
    "hostel": "lodging",
    "pousada": "lodging",
    "resort": "lodging",
    "vacation rental": "lodging",
    "apartment": "lodging",
    "apartamento": "lodging",
    "tour": "activity",
    "experience": "activity",
    "experiencia": "activity",
    "atracao": "attraction",
    "sight": "attraction",
    "landmark": "attraction",
    "museum": "attraction",
    "park": "attraction",
    "bar": "restaurant",
    "cafe": "restaurant",
    "food": "restaurant",
}

DESTINATION_EXTRACTION_PROMPT = (
    "Voce esta extraindo dados de um guia turistico para alimentar um app de viagem. "
    "Resuma o destino em 2 a 3 paragrafos focando no que o torna especial. "
    "Custos sao diarias estimadas em BRL (low/mid/high) para um viajante. "
    "Liste ate 10 POIs entre atracoes, restaurantes notaveis, atividades e bairros/hoteis para hospedar-se. "
    "Use exatamente um destes valores no campo 'type': attraction, restaurant, activity, lodging. "
    "Para 'hero_image_url' devolva a URL absoluta de uma imagem representativa do destino (banner/og:image). "
    "Cada POI pode incluir 'image_url' com uma foto representativa."
)

DESTINATION_EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "country": {"type": "string"},
        "city": {"type": "string"},
        "summary": {"type": "string"},
        "hero_image_url": {
            "type": "string",
            "description": "URL absoluta de uma imagem hero/banner representativa do destino",
        },
        "best_season": {"type": "string"},
        "timezone": {"type": "string"},
        "costs": {
            "type": "object",
            "properties": {
                "low": {"type": "number"},
                "mid": {"type": "number"},
                "high": {"type": "number"},
            },
        },
        "pois": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "type": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "summary": {"type": "string"},
                    "image_url": {"type": "string"},
                },
                "required": ["name"],
            },
        },
    },
}


class FirecrawlError(Exception):
    pass


@dataclass
class IngestionResult:
    destination_updated: bool
    poi_count: int
    cost_profile_updated: bool


@dataclass
class AggregatedExtraction:
    """Dados agregados do scrape de uma ou mais URLs, sem tocar no DB."""

    source_urls: list[str] = field(default_factory=list)
    extracted_meta: dict[str, Any] = field(default_factory=dict)
    pois: list[dict[str, Any]] = field(default_factory=list)
    costs: dict[str, Any] | None = None
    failures: list[dict[str, str]] = field(default_factory=list)

    def has_meaningful_data(self) -> bool:
        return bool(self.extracted_meta.get("summary")) or bool(self.pois)


class FirecrawlIngestionService:
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {settings.FIRECRAWL_API_KEY}"}

    def _request(self, path: str, json_body: dict, *, timeout: float | tuple[float, float] | None = None) -> dict:
        url = f"{settings.FIRECRAWL_API_URL}{path}"
        effective_timeout = timeout if timeout is not None else (
            settings.FIRECRAWL_CONNECT_TIMEOUT,
            settings.FIRECRAWL_SCRAPE_TIMEOUT,
        )
        try:
            response = requests.post(url, json=json_body, headers=self._headers(), timeout=effective_timeout)
        except requests.RequestException as exc:
            raise FirecrawlError(f"Falha de rede ao contatar o Firecrawl ({path}): {exc}") from exc

        if response.status_code == 401:
            raise FirecrawlError(f"Credencial Firecrawl invalida (HTTP 401) em {path}")
        if response.status_code == 429:
            raise FirecrawlError(f"Limite de requisicoes do Firecrawl atingido (HTTP 429) em {path}")
        if response.status_code >= 500:
            raise FirecrawlError(
                f"Firecrawl indisponivel (HTTP {response.status_code}) em {path}: {response.text[:300]}"
            )
        if response.status_code >= 400:
            raise FirecrawlError(
                f"Firecrawl rejeitou requisicao (HTTP {response.status_code}) em {path}: {response.text[:300]}"
            )

        try:
            body = response.json()
        except ValueError as exc:
            raise FirecrawlError(
                f"Firecrawl devolveu resposta nao-JSON em {path}: {response.text[:300]}"
            ) from exc

        if isinstance(body, dict) and body.get("success") is False:
            raise FirecrawlError(
                f"Firecrawl reportou falha em {path}: {body.get('error') or 'sem detalhe'}"
            )
        return body if isinstance(body, dict) else {}

    def _mock_payload(self, *, query: str = "", url: str = "") -> dict:
        label = query or url or "destino"
        return {
            "name": query.title() if query else "",
            "country": "",
            "city": "",
            "summary": f"Resumo curado para {label} (mock - defina FIRECRAWL_API_KEY para usar o servico real).",
            "hero_image_url": "",
            "best_season": "",
            "timezone": "",
            "costs": {"low": 80, "mid": 140, "high": 240},
            "pois": [
                {
                    "name": "Caminhada pelo centro historico",
                    "type": "attraction",
                    "tags": ["culture", "walking"],
                    "summary": "Exploracao guiada do nucleo da cidade.",
                    "image_url": "",
                },
                {
                    "name": "Tour gastronomico no mercado",
                    "type": "restaurant",
                    "tags": ["food"],
                    "summary": "Pratos e produtos regionais.",
                    "image_url": "",
                },
            ],
        }

    def _fetch(self, url: str) -> dict:
        if not settings.FIRECRAWL_API_KEY:
            return self._mock_payload(url=url)

        body = self._request(
            "/scrape",
            {
                "url": url,
                "formats": ["json"],
                "jsonOptions": {
                    "schema": DESTINATION_EXTRACTION_SCHEMA,
                    "prompt": DESTINATION_EXTRACTION_PROMPT,
                },
            },
            timeout=(settings.FIRECRAWL_CONNECT_TIMEOUT, settings.FIRECRAWL_SCRAPE_TIMEOUT),
        )
        data = body.get("data") or {}
        extracted = data.get("json") or data.get("extract") or {}
        return extracted if isinstance(extracted, dict) else {}

    def _search_urls(self, query: str, *, country: str = "", limit: int | None = None) -> list[str]:
        effective_limit = limit if limit is not None else settings.FIRECRAWL_SEARCH_LIMIT
        if not settings.FIRECRAWL_API_KEY:
            return [f"https://en.wikipedia.org/wiki/{slugify(query)}"]

        search_terms = [query, "turismo"]
        if country:
            search_terms.append(country)
        else:
            search_terms.append("Brasil")
        search_query = " ".join(search_terms)

        body = self._request(
            "/search",
            {"query": search_query, "limit": effective_limit},
            timeout=(settings.FIRECRAWL_CONNECT_TIMEOUT, settings.FIRECRAWL_SEARCH_TIMEOUT),
        )
        items = body.get("data") or []
        if not isinstance(items, list):
            return []
        urls: list[str] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            link = item.get("url")
            if link and self._is_supported_url(link):
                urls.append(link)
        return urls

    @staticmethod
    def _is_supported_url(url: str) -> bool:
        lowered = url.lower()
        for host in UNSUPPORTED_SEARCH_HOSTS:
            if f"//{host}/" in lowered or f"//www.{host}/" in lowered:
                return False
        return True

    @staticmethod
    def _wikipedia_fallback_url(query: str) -> str:
        slug = slugify(query).replace("-", "_") or query.strip().replace(" ", "_")
        return f"https://pt.wikipedia.org/wiki/{slug}"

    def _aggregate_payloads(self, source_urls: list[str]) -> AggregatedExtraction:
        """Faz scrape de cada URL sem tocar no DB.

        - Tolerante a falhas por URL: se uma URL der erro, registra em `failures` e segue.
        - Early-exit assim que tiver `summary` + ao menos um POI.
        - Levanta FirecrawlError apenas se TODAS as URLs falharem.
        """
        agg = AggregatedExtraction(source_urls=list(source_urls))
        attempted = 0

        for url in source_urls:
            attempted += 1
            try:
                payload = self._fetch(url)
            except FirecrawlError as exc:
                logger.warning("Firecrawl scrape falhou para url=%s: %s", url, exc)
                agg.failures.append({"url": url, "error": str(exc)})
                continue

            if not payload:
                continue

            for key in ("name", "country", "city", "best_season", "timezone", "summary", "hero_image_url"):
                value = payload.get(key)
                if value and not agg.extracted_meta.get(key):
                    agg.extracted_meta[key] = value

            costs = payload.get("costs")
            if agg.costs is None and isinstance(costs, dict):
                agg.costs = costs

            for poi in payload.get("pois") or []:
                if isinstance(poi, dict):
                    agg.pois.append({**poi, "source_url": url})

            if agg.extracted_meta.get("summary") and agg.pois:
                logger.info(
                    "Firecrawl early-exit apos url=%s (summary + %d pois)",
                    url, len(agg.pois),
                )
                break

        if attempted and len(agg.failures) == attempted:
            raise FirecrawlError(
                f"Todas as {attempted} URLs falharam no scrape: {agg.failures[-1]['error']}"
            )

        return agg

    @staticmethod
    def _failure_cache_key(slug: str) -> str:
        return f"firecrawl:discover_failed:{slug}"

    def _is_recently_failed(self, slug: str) -> bool:
        if not getattr(settings, "FIRECRAWL_DISCOVERY_FAILURE_TTL", 0):
            return False
        return bool(cache.get(self._failure_cache_key(slug)))

    def _mark_recently_failed(self, slug: str) -> None:
        ttl = getattr(settings, "FIRECRAWL_DISCOVERY_FAILURE_TTL", 0)
        if ttl > 0:
            cache.set(self._failure_cache_key(slug), True, timeout=ttl)

    def discover_destination(
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

        if self._is_recently_failed(slug):
            logger.info(
                "Pulando Firecrawl para slug=%s (falhou recentemente, ttl=%ss)",
                slug, settings.FIRECRAWL_DISCOVERY_FAILURE_TTL,
            )
            return None

        try:
            urls = self._search_urls(query, country=country)
        except FirecrawlError:
            logger.exception("Firecrawl search falhou para query=%s", query)
            urls = []

        wiki_fallback = self._wikipedia_fallback_url(query)
        if not urls:
            logger.info(
                "Firecrawl search sem URLs uteis para query=%s, usando fallback %s",
                query, wiki_fallback,
            )
            urls = [wiki_fallback]

        try:
            aggregated = self._aggregate_payloads(urls)
        except FirecrawlError:
            if wiki_fallback in urls:
                logger.exception(
                    "Firecrawl scrape falhou em todas as URLs (incluindo wikipedia) para slug=%s",
                    slug,
                )
                self._mark_recently_failed(slug)
                return None
            logger.warning(
                "Firecrawl scrape falhou em todas as %d URLs do search para slug=%s, "
                "tentando fallback wikipedia",
                len(urls), slug,
            )
            try:
                aggregated = self._aggregate_payloads([wiki_fallback])
            except FirecrawlError:
                logger.exception("Fallback wikipedia tambem falhou para slug=%s", slug)
                self._mark_recently_failed(slug)
                return None

        if not aggregated.has_meaningful_data():
            logger.info(
                "Firecrawl nao extraiu dados uteis para slug=%s (falhas=%d)",
                slug, len(aggregated.failures),
            )
            self._mark_recently_failed(slug)
            return None

        placeholder_name = query.strip().title()[:150]
        placeholder_country = (country.strip() or "Desconhecido")[:100]

        with transaction.atomic():
            destination, created = Destination.objects.get_or_create(
                slug=slug,
                defaults={
                    "name": placeholder_name,
                    "country": placeholder_country,
                    "city": city.strip()[:100],
                    "created_by": actor if actor and getattr(actor, "is_authenticated", False) else None,
                },
            )
            self._persist_extraction(
                destination=destination,
                source_urls=urls,
                aggregated=aggregated,
            )
            if created:
                self._promote_extracted_fields(destination, placeholder_name=placeholder_name)

        return destination

    def _promote_extracted_fields(self, destination: Destination, *, placeholder_name: str) -> None:
        extracted = (destination.metadata or {}).get("extracted") or {}
        updates: list[str] = []

        new_name = (extracted.get("name") or "").strip()[:150]
        if new_name and destination.name == placeholder_name and new_name != placeholder_name:
            destination.name = new_name
            updates.append("name")

        new_country = (extracted.get("country") or "").strip()[:100]
        if new_country and destination.country == "Desconhecido":
            destination.country = new_country
            updates.append("country")

        new_city = (extracted.get("city") or "").strip()[:100]
        if new_city and not destination.city:
            destination.city = new_city
            updates.append("city")

        if updates:
            destination.save(update_fields=updates)

    @transaction.atomic
    def ingest_destination(self, *, destination: Destination, source_urls: list[str]) -> IngestionResult:
        """Compatibilidade com o endpoint admin `/api/firecrawl/ingest/`.

        Para a busca publica, prefira `discover_destination`, que so cria o destination
        apos o scrape retornar dados uteis.
        """
        aggregated = self._aggregate_payloads(source_urls)
        return self._persist_extraction(
            destination=destination,
            source_urls=source_urls,
            aggregated=aggregated,
        )

    def _persist_extraction(
        self,
        *,
        destination: Destination,
        source_urls: list[str],
        aggregated: AggregatedExtraction,
    ) -> IngestionResult:
        meta = aggregated.extracted_meta

        if meta.get("summary"):
            destination.summary = str(meta["summary"])[:4000]
        if meta.get("best_season"):
            destination.best_season = str(meta["best_season"])[:120]
        if meta.get("timezone"):
            destination.timezone = str(meta["timezone"])[:64]
        hero = self._clean_url(meta.get("hero_image_url"))
        if hero and not destination.hero_image_url:
            destination.hero_image_url = hero[:200]

        existing_meta = destination.metadata if isinstance(destination.metadata, dict) else {}
        destination.metadata = {
            **existing_meta,
            "source_urls": source_urls,
            "extracted": meta,
            "scrape_failures": aggregated.failures,
        }
        destination.save()

        cost_profile_updated = False
        costs = aggregated.costs
        if costs and all(costs.get(k) is not None for k in ("low", "mid", "high")):
            DestinationCostProfile.objects.update_or_create(
                destination=destination,
                defaults={
                    "currency_code": "BRL",
                    "daily_budget_low": costs["low"],
                    "daily_budget_mid": costs["mid"],
                    "daily_budget_high": costs["high"],
                    "source_url": source_urls[0] if source_urls else "",
                },
            )
            cost_profile_updated = True

        poi_count = 0
        for poi_data in aggregated.pois:
            name = (poi_data.get("name") or "").strip()
            if not name:
                continue
            poi_slug = slugify(name)
            if not poi_slug:
                continue
            poi_type = self._normalize_poi_type(poi_data.get("type"))
            image_url = self._clean_url(poi_data.get("image_url"))
            existing_poi = PointOfInterest.objects.filter(destination=destination, slug=poi_slug).first()
            poi_metadata = dict(existing_poi.metadata) if existing_poi and isinstance(existing_poi.metadata, dict) else {}
            if image_url:
                poi_metadata["image_url"] = image_url[:500]
            poi, _ = PointOfInterest.objects.update_or_create(
                destination=destination,
                slug=poi_slug,
                defaults={
                    "name": name[:160],
                    "poi_type": poi_type,
                    "summary": (poi_data.get("summary") or "")[:4000],
                    "source_url": (poi_data.get("source_url") or "")[:200],
                    "metadata": poi_metadata,
                },
            )
            tags = []
            for tag_name in poi_data.get("tags") or []:
                tag_str = str(tag_name).strip()
                if not tag_str:
                    continue
                tag_slug = slugify(tag_str)
                if not tag_slug:
                    continue
                tag, _ = POITag.objects.get_or_create(
                    slug=tag_slug,
                    defaults={"name": tag_str.title()[:80]},
                )
                tags.append(tag)
            if tags:
                poi.tags.set(tags)
            poi_count += 1

        return IngestionResult(
            destination_updated=True,
            poi_count=poi_count,
            cost_profile_updated=cost_profile_updated,
        )

    @staticmethod
    def _normalize_poi_type(raw_type) -> str:
        candidate = (str(raw_type or "")).strip().lower()
        if candidate in VALID_POI_TYPES:
            return candidate
        if candidate in POI_TYPE_ALIASES:
            return POI_TYPE_ALIASES[candidate]
        for alias, mapped in POI_TYPE_ALIASES.items():
            if alias in candidate:
                return mapped
        return "activity"

    @staticmethod
    def _clean_url(raw_url) -> str:
        url = (str(raw_url or "")).strip()
        if not url:
            return ""
        if not (url.startswith("http://") or url.startswith("https://")):
            return ""
        return url
