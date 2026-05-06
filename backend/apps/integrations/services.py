from __future__ import annotations

from dataclasses import dataclass

import requests
from django.conf import settings
from django.db import transaction
from django.utils.text import slugify

from apps.destinations.models import Destination, DestinationCostProfile, POITag, PointOfInterest


@dataclass
class IngestionResult:
    destination_updated: bool
    poi_count: int
    cost_profile_updated: bool


class FirecrawlIngestionService:
    def _fetch(self, url: str) -> dict:
        if not settings.FIRECRAWL_API_KEY:
            return {
                "summary": f"Curated summary for {url}",
                "costs": {"low": 80, "mid": 140, "high": 240},
                "pois": [
                    {"name": "Historic Center Walk", "type": "attraction", "tags": ["culture", "walking"], "summary": "A guided city-core exploration."},
                    {"name": "Market Food Crawl", "type": "restaurant", "tags": ["food"], "summary": "Sample regional dishes and produce."},
                ],
            }

        response = requests.post(
            f"{settings.FIRECRAWL_API_URL}/scrape",
            json={"url": url, "formats": ["markdown"]},
            headers={"Authorization": f"Bearer {settings.FIRECRAWL_API_KEY}"},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    @transaction.atomic
    def ingest_destination(self, *, destination: Destination, source_urls: list[str]) -> IngestionResult:
        aggregated = {"pois": []}
        for url in source_urls:
            payload = self._fetch(url)
            if payload.get("summary"):
                destination.summary = payload["summary"][:4000]
            if payload.get("costs"):
                aggregated["costs"] = payload["costs"]
            for poi in payload.get("pois", []):
                poi["source_url"] = url
                aggregated["pois"].append(poi)

        destination.metadata["source_urls"] = source_urls
        destination.save()

        cost_profile_updated = False
        if aggregated.get("costs"):
            DestinationCostProfile.objects.update_or_create(
                destination=destination,
                defaults={
                    "currency_code": "BRL",
                    "daily_budget_low": aggregated["costs"]["low"],
                    "daily_budget_mid": aggregated["costs"]["mid"],
                    "daily_budget_high": aggregated["costs"]["high"],
                    "source_url": source_urls[0],
                },
            )
            cost_profile_updated = True

        poi_count = 0
        for poi_data in aggregated["pois"]:
            poi, _ = PointOfInterest.objects.update_or_create(
                destination=destination,
                slug=slugify(poi_data["name"]),
                defaults={
                    "name": poi_data["name"],
                    "poi_type": poi_data.get("type", "activity"),
                    "summary": poi_data.get("summary", ""),
                    "source_url": poi_data.get("source_url", ""),
                },
            )
            tags = []
            for tag_name in poi_data.get("tags", []):
                tag, _ = POITag.objects.get_or_create(name=tag_name.title(), slug=slugify(tag_name))
                tags.append(tag)
            if tags:
                poi.tags.set(tags)
            poi_count += 1

        return IngestionResult(destination_updated=True, poi_count=poi_count, cost_profile_updated=cost_profile_updated)

