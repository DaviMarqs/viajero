"""Gerador de roteiro via Gemini."""
from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings

from apps.ai.providers.base import LLMProviderError, LLMResponseError
from apps.ai.providers.gemini import GeminiProvider
from apps.ai.models import PromptTemplate
from apps.ai.services import BaseItineraryGenerator
from apps.destinations.models import PointOfInterest
from apps.itineraries.models import Itinerary
from apps.profiles.models import TravelerDNAProfile, UserTripPreference


logger = logging.getLogger(__name__)


ITINERARY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "estimated_cost": {"type": "string"},
        "currency_code": {"type": "string"},
        "days": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "events": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "poi_id": {"type": ["integer", "null"]},
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "start_time": {"type": "string"},
                                "end_time": {"type": "string"},
                                "estimated_cost": {"type": "string"},
                                "order_index": {"type": "integer"},
                            },
                            "required": ["title", "description", "order_index"],
                        },
                    },
                },
                "required": ["title", "events"],
            },
        },
    },
    "required": ["title", "days"],
}


class GeminiItineraryGenerator(BaseItineraryGenerator):
    def __init__(self, provider: GeminiProvider | None = None) -> None:
        self._provider = provider or GeminiProvider()

    def generate(
        self,
        *,
        itinerary: Itinerary,
        profile: TravelerDNAProfile | None,
        preferences: UserTripPreference | None,
        pois: list[PointOfInterest],
        prompt_template: PromptTemplate | None,
    ) -> dict[str, Any]:
        context = self._build_context(itinerary, profile, preferences, pois)
        prompt = self._build_prompt(context, prompt_template)

        for attempt in (1, 2):
            try:
                payload = self._provider.generate_json(
                    prompt,
                    ITINERARY_SCHEMA,
                    timeout=settings.GEMINI_ITINERARY_TIMEOUT,
                )
            except LLMResponseError as exc:
                logger.warning("Gemini itinerary attempt %d response error: %s", attempt, exc)
                if attempt == 2:
                    raise
                prompt = self._reinforce_prompt(prompt)
                continue
            except LLMProviderError:
                raise

            return self._normalize_payload(payload, itinerary, pois)

        # Unreachable: o loop sempre retorna ou levanta.
        raise LLMResponseError("Gemini nao retornou roteiro valido")

    def _build_context(
        self,
        itinerary: Itinerary,
        profile: TravelerDNAProfile | None,
        preferences: UserTripPreference | None,
        pois: list[PointOfInterest],
    ) -> dict[str, Any]:
        ranked = sorted(pois, key=lambda p: (-(p.rating or 0), p.name))[:30]
        return {
            "destination": {
                "id": itinerary.destination_id,
                "name": itinerary.destination.name,
                "country": itinerary.destination.country,
                "city": itinerary.destination.city,
                "summary": itinerary.destination.summary[:500],
            },
            "duration_days": itinerary.duration_days,
            "currency_code": itinerary.currency_code,
            "budget_total": str(itinerary.budget_total),
            "profile": {
                "travel_style": getattr(profile, "travel_style", "flexivel"),
                "pace": getattr(profile, "pace", "balanced"),
            } if profile else None,
            "preferences": {
                "currency_code": getattr(preferences, "currency_code", itinerary.currency_code),
            } if preferences else None,
            "pois": [
                {
                    "id": p.id,
                    "name": p.name,
                    "type": p.poi_type,
                    "rating": str(p.rating),
                }
                for p in ranked
            ],
        }

    def _build_prompt(self, context: dict[str, Any], prompt_template) -> str:
        intro = (
            "Voce e um planejador de viagens. "
            f"Crie um roteiro de {context['duration_days']} dias para "
            f"{context['destination']['name']} ({context['destination']['country']}). "
            f"Orcamento total: {context['budget_total']} {context['currency_code']}. "
            "Prefira eventos que referenciem POIs existentes via 'poi_id'. "
            "Voce pode incluir eventos extras (refeicoes, transporte) com poi_id=null. "
            "Cada dia deve ter entre 2 e 5 eventos. "
            "estimated_cost de cada evento e do roteiro inteiro como string decimal."
        )
        if prompt_template and getattr(prompt_template, "template", ""):
            intro = f"{intro}\n\nTemplate adicional:\n{prompt_template.template}"
        return f"{intro}\n\nContexto:\n{json.dumps(context, ensure_ascii=False)}"

    def _reinforce_prompt(self, prompt: str) -> str:
        return (
            f"{prompt}\n\n"
            "IMPORTANTE: Sua resposta anterior nao era JSON valido. "
            "Responda APENAS com JSON, sem texto antes ou depois."
        )

    def _normalize_payload(
        self,
        payload: dict[str, Any],
        itinerary: Itinerary,
        pois: list[PointOfInterest],
    ) -> dict[str, Any]:
        valid_poi_ids = set(
            PointOfInterest.objects.filter(
                destination=itinerary.destination,
                id__in=self._collect_poi_ids(payload),
            ).values_list("id", flat=True)
        )

        days_out = []
        for day in payload.get("days") or []:
            events_out = []
            for event in day.get("events") or []:
                poi_id = event.get("poi_id")
                if poi_id is not None and poi_id not in valid_poi_ids:
                    logger.warning(
                        "Gemini referenciou poi_id=%s invalido para destino=%s; descartando FK",
                        poi_id, itinerary.destination_id,
                    )
                    poi_id = None
                events_out.append(
                    {
                        "poi_id": poi_id,
                        "title": str(event.get("title") or "")[:160],
                        "description": str(event.get("description") or "")[:4000],
                        "estimated_cost": str(event.get("estimated_cost") or "0"),
                        "order_index": int(event.get("order_index") or 0),
                    }
                )
            days_out.append(
                {
                    "title": str(day.get("title") or "")[:120],
                    "summary": str(day.get("summary") or "")[:4000],
                    "events": events_out,
                }
            )

        return {
            "title": str(payload.get("title") or itinerary.title)[:160],
            "summary": str(payload.get("summary") or ""),
            "estimated_cost": str(payload.get("estimated_cost") or "0"),
            "currency_code": str(payload.get("currency_code") or itinerary.currency_code),
            "days": days_out,
            "metadata": {
                "generator": "gemini",
                "model": settings.GEMINI_MODEL,
                "poi_count": len(pois),
            },
        }

    @staticmethod
    def _collect_poi_ids(payload: dict[str, Any]) -> list[int]:
        ids: list[int] = []
        for day in payload.get("days") or []:
            for event in day.get("events") or []:
                poi_id = event.get("poi_id")
                if isinstance(poi_id, int):
                    ids.append(poi_id)
        return ids
