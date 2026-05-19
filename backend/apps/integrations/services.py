from __future__ import annotations

import logging
from dataclasses import dataclass

import requests
from django.conf import settings
from django.db import transaction
from django.utils.text import slugify

from apps.destinations.models import Destination, DestinationCostProfile, POITag, PointOfInterest


logger = logging.getLogger(__name__)


VALID_POI_TYPES = {"attraction", "restaurant", "activity", "lodging"}

DESTINATION_EXTRACTION_PROMPT = (
    "Voce esta extraindo dados de um guia turistico para alimentar um app de viagem. "
    "Resuma o destino em 2 a 3 paragrafos focando no que o torna especial. "
    "Custos sao diarias estimadas em BRL (low/mid/high) para um viajante. "
    "Liste ate 10 POIs entre atracoes, restaurantes notaveis, atividades e bairros/hoteis para hospedar-se. "
    "Use exatamente um destes valores no campo 'type': attraction, restaurant, activity, lodging."
)

DESTINATION_EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "country": {"type": "string"},
        "city": {"type": "string"},
        "summary": {"type": "string"},
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


class FirecrawlIngestionService:
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {settings.FIRECRAWL_API_KEY}"}

    def _request(self, path: str, json_body: dict, *, timeout: int = 90) -> dict:
        url = f"{settings.FIRECRAWL_API_URL}{path}"
        try:
            response = requests.post(url, json=json_body, headers=self._headers(), timeout=timeout)
        except requests.RequestException as exc:
            raise FirecrawlError(f"Falha de rede ao contatar o Firecrawl: {exc}") from exc

        if response.status_code == 401:
            raise FirecrawlError("Credencial Firecrawl invalida (HTTP 401)")
        if response.status_code == 429:
            raise FirecrawlError("Limite de requisicoes do Firecrawl atingido (HTTP 429)")
        if response.status_code >= 500:
            raise FirecrawlError(f"Firecrawl indisponivel (HTTP {response.status_code})")
        response.raise_for_status()

        body = response.json()
        if isinstance(body, dict) and body.get("success") is False:
            raise FirecrawlError(body.get("error") or "Resposta do Firecrawl sem sucesso")
        return body if isinstance(body, dict) else {}

    def _mock_payload(self, *, query: str = "", url: str = "") -> dict:
        label = query or url or "destino"
        return {
            "name": query.title() if query else "",
            "country": "",
            "city": "",
            "summary": f"Resumo curado para {label} (mock - defina FIRECRAWL_API_KEY para usar o servico real).",
            "best_season": "",
            "timezone": "",
            "costs": {"low": 80, "mid": 140, "high": 240},
            "pois": [
                {
                    "name": "Caminhada pelo centro historico",
                    "type": "attraction",
                    "tags": ["culture", "walking"],
                    "summary": "Exploracao guiada do nucleo da cidade.",
                },
                {
                    "name": "Tour gastronomico no mercado",
                    "type": "restaurant",
                    "tags": ["food"],
                    "summary": "Pratos e produtos regionais.",
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
        )
        data = body.get("data") or {}
        extracted = data.get("json") or data.get("extract") or {}
        return extracted if isinstance(extracted, dict) else {}

    def _search_urls(self, query: str, limit: int = 3) -> list[str]:
        if not settings.FIRECRAWL_API_KEY:
            return [f"https://en.wikipedia.org/wiki/{slugify(query)}"]

        body = self._request(
            "/search",
            {"query": f"{query} guia turistico", "limit": limit},
            timeout=30,
        )
        items = body.get("data") or []
        if not isinstance(items, list):
            return []
        urls: list[str] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            link = item.get("url")
            if link:
                urls.append(link)
        return urls

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

        try:
            urls = self._search_urls(query, limit=3)
        except FirecrawlError:
            logger.exception("Firecrawl search falhou para query=%s", query)
            return None

        if not urls:
            return None

        placeholder_name = query.strip().title()[:150]
        placeholder_country = (country.strip() or "Desconhecido")[:100]

        destination, created = Destination.objects.get_or_create(
            slug=slug,
            defaults={
                "name": placeholder_name,
                "country": placeholder_country,
                "city": city.strip()[:100],
                "created_by": actor if actor and getattr(actor, "is_authenticated", False) else None,
            },
        )

        try:
            self.ingest_destination(destination=destination, source_urls=urls)
        except FirecrawlError:
            logger.exception("Firecrawl ingestao falhou para destination=%s", destination.slug)
            return destination

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
        aggregated_costs: dict | None = None
        pois_payload: list[dict] = []
        extracted_meta: dict = {}

        for url in source_urls:
            payload = self._fetch(url)
            if not payload:
                continue

            for key in ("name", "country", "city", "best_season", "timezone", "summary"):
                value = payload.get(key)
                if value and not extracted_meta.get(key):
                    extracted_meta[key] = value

            if payload.get("summary"):
                destination.summary = str(payload["summary"])[:4000]
            if payload.get("best_season"):
                destination.best_season = str(payload["best_season"])[:120]
            if payload.get("timezone"):
                destination.timezone = str(payload["timezone"])[:64]

            costs = payload.get("costs")
            if aggregated_costs is None and isinstance(costs, dict):
                aggregated_costs = costs

            for poi in payload.get("pois") or []:
                if isinstance(poi, dict):
                    pois_payload.append({**poi, "source_url": url})

        existing_meta = destination.metadata if isinstance(destination.metadata, dict) else {}
        destination.metadata = {**existing_meta, "source_urls": source_urls, "extracted": extracted_meta}
        destination.save()

        cost_profile_updated = False
        if aggregated_costs and all(aggregated_costs.get(k) is not None for k in ("low", "mid", "high")):
            DestinationCostProfile.objects.update_or_create(
                destination=destination,
                defaults={
                    "currency_code": "BRL",
                    "daily_budget_low": aggregated_costs["low"],
                    "daily_budget_mid": aggregated_costs["mid"],
                    "daily_budget_high": aggregated_costs["high"],
                    "source_url": source_urls[0] if source_urls else "",
                },
            )
            cost_profile_updated = True

        poi_count = 0
        for poi_data in pois_payload:
            name = (poi_data.get("name") or "").strip()
            if not name:
                continue
            poi_slug = slugify(name)
            if not poi_slug:
                continue
            poi_type = poi_data.get("type") or "activity"
            if poi_type not in VALID_POI_TYPES:
                poi_type = "activity"
            poi, _ = PointOfInterest.objects.update_or_create(
                destination=destination,
                slug=poi_slug,
                defaults={
                    "name": name[:160],
                    "poi_type": poi_type,
                    "summary": (poi_data.get("summary") or "")[:4000],
                    "source_url": (poi_data.get("source_url") or "")[:200],
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

        return IngestionResult(destination_updated=True, poi_count=poi_count, cost_profile_updated=cost_profile_updated)
