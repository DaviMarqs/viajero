from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction

from apps.destinations.models import Destination, PointOfInterest
from apps.itineraries.models import Itinerary, ItineraryDailyEvent, ItineraryDay
from apps.profiles.models import TravelerDNAProfile, UserTripPreference

from .models import LLMJob, LLMJobLog, LLMModel, PromptTemplate

logger = logging.getLogger(__name__)

# Limites para manter o prompt dentro de um tamanho razoavel.
MAX_POIS_IN_PROMPT = 40
DEFAULT_GEMINI_MODEL = "gemini-1.5-flash"
GEMINI_TIMEOUT_SECONDS = 60


class ItineraryGenerationError(Exception):
    """Erro de negocio levantado quando a geracao de roteiro falha."""


@dataclass
class GeneratedDay:
    title: str
    summary: str
    events: list[dict]


# ---------------------------------------------------------------------------
# Generators
# ---------------------------------------------------------------------------


class BaseItineraryGenerator:
    def generate(
        self,
        *,
        itinerary: Itinerary,
        profile: TravelerDNAProfile | None,
        preferences: UserTripPreference | None,
        pois: list[PointOfInterest],
        prompt_template: PromptTemplate | None,
    ) -> dict:
        raise NotImplementedError


class MockItineraryGenerator(BaseItineraryGenerator):
    """Fallback usado quando nao ha GEMINI_API_KEY configurada (dev/tests)."""

    def generate(
        self,
        *,
        itinerary: Itinerary,
        profile: TravelerDNAProfile | None,
        preferences: UserTripPreference | None,
        pois: list[PointOfInterest],
        prompt_template: PromptTemplate | None,
    ) -> dict:
        selected_pois = pois[: max(itinerary.duration_days * 3, 1)]
        days = []
        for index in range(itinerary.duration_days):
            chunk = selected_pois[index * 3 : index * 3 + 3] or selected_pois[:3]
            events = []
            for event_index, poi in enumerate(chunk):
                events.append(
                    {
                        "title": poi.name,
                        "description": poi.summary or f"Explore {poi.name} in depth.",
                        "estimated_cost": str(Decimal(20 + event_index * 15)),
                        "order_index": event_index,
                        "poi_id": poi.id,
                    }
                )
            days.append(
                {
                    "title": f"Day {index + 1}: {itinerary.destination.name}",
                    "summary": f"Balanced plan shaped for {getattr(profile, 'travel_style', 'flexible')} travel.",
                    "events": events,
                }
            )
        return {
            "title": itinerary.title or f"{itinerary.destination.name} Adventure",
            "summary": f"{itinerary.duration_days}-day itinerary for {itinerary.destination.name}.",
            "currency_code": getattr(preferences, "currency_code", itinerary.currency_code),
            "estimated_cost": str(Decimal(itinerary.duration_days * 120)),
            "days": days,
            "metadata": {
                "generator": "mock",
                "template_key": getattr(prompt_template, "key", None),
                "poi_count": len(selected_pois),
            },
        }


class GeminiItineraryGenerator(BaseItineraryGenerator):
    """
    Gera roteiros usando a API do Google Gemini com JSON mode.

    Estrategia:
      - Manda Traveler DNA + TripPreference + lista de POIs reais (grounding).
      - Pede resposta em JSON estrito com schema acordado (response_mime_type).
      - Valida e normaliza o output antes de devolver pro service.
    """

    DEFAULT_SYSTEM_PROMPT = (
        "You are a senior travel planner who designs realistic, well-paced day-by-day "
        "itineraries. You always respect the traveler's profile, budget and preferences. "
        "You only recommend places that appear in the provided POI list and reference them "
        "by their poi_id. You answer with a single JSON object that matches the requested "
        "schema exactly, with no extra text and no markdown fences."
    )

    def __init__(self, api_key: str, model: str = DEFAULT_GEMINI_MODEL):
        # Import local para nao quebrar o boot quando o pacote nao esta instalado
        # em ambientes que so usam o mock.
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        self._genai = genai
        self._model_name = model

    # -- prompt building ---------------------------------------------------

    def _serialize_profile(self, profile: TravelerDNAProfile | None) -> dict:
        if not profile:
            return {}
        return {
            "travel_style": profile.travel_style,
            "pace": profile.pace,
            "comfort_level": profile.comfort_level,
            "social_energy": profile.social_energy,
            "adventure_level": profile.adventure_level,
            "food_focus": profile.food_focus,
            "cultural_interest": profile.cultural_interest,
            "nature_interest": profile.nature_interest,
            "nightlife_interest": profile.nightlife_interest,
            "notes": profile.notes,
        }

    def _serialize_preferences(self, preferences: UserTripPreference | None) -> dict:
        if not preferences:
            return {}
        return {
            "budget_min": str(preferences.budget_min),
            "budget_max": str(preferences.budget_max),
            "currency_code": preferences.currency_code,
            "preferred_trip_length_days": preferences.preferred_trip_length_days,
            "travel_month": preferences.travel_month,
            "hotel_level": preferences.hotel_level,
            "transportation_style": preferences.transportation_style,
            "dietary_preferences": preferences.dietary_preferences,
            "accessibility_needs": preferences.accessibility_needs,
            "interests": preferences.interests,
        }

    def _serialize_destination(self, destination: Destination) -> dict:
        cost_profile = getattr(destination, "cost_profile", None)
        data = {
            "id": destination.id,
            "name": destination.name,
            "country": destination.country,
            "city": destination.city,
            "summary": destination.summary,
            "timezone": destination.timezone,
            "best_season": destination.best_season,
        }
        if cost_profile:
            data["cost_profile"] = {
                "currency_code": cost_profile.currency_code,
                "daily_budget_low": str(cost_profile.daily_budget_low),
                "daily_budget_mid": str(cost_profile.daily_budget_mid),
                "daily_budget_high": str(cost_profile.daily_budget_high),
            }
        return data

    def _serialize_pois(self, pois: list[PointOfInterest]) -> list[dict]:
        serialized = []
        for poi in pois[:MAX_POIS_IN_PROMPT]:
            serialized.append(
                {
                    "id": poi.id,
                    "name": poi.name,
                    "type": poi.poi_type,
                    "summary": poi.summary,
                    "price_level": poi.price_level,
                    "estimated_visit_minutes": poi.estimated_visit_minutes,
                    "tags": [tag.slug for tag in poi.tags.all()],
                }
            )
        return serialized

    def _build_user_prompt(
        self,
        *,
        itinerary: Itinerary,
        profile: TravelerDNAProfile | None,
        preferences: UserTripPreference | None,
        pois: list[PointOfInterest],
        prompt_template: PromptTemplate | None,
    ) -> str:
        context = {
            "trip": {
                "title": itinerary.title,
                "destination": self._serialize_destination(itinerary.destination),
                "duration_days": itinerary.duration_days,
                "start_date": itinerary.start_date.isoformat() if itinerary.start_date else None,
                "end_date": itinerary.end_date.isoformat() if itinerary.end_date else None,
                "budget_total": str(itinerary.budget_total),
                "currency_code": itinerary.currency_code,
            },
            "traveler_dna": self._serialize_profile(profile),
            "trip_preferences": self._serialize_preferences(preferences),
            "available_pois": self._serialize_pois(pois),
        }

        schema_hint = {
            "title": "string",
            "summary": "string",
            "currency_code": "ISO-4217 string",
            "estimated_cost": "string decimal (total trip cost)",
            "days": [
                {
                    "title": "string",
                    "summary": "string",
                    "events": [
                        {
                            "title": "string",
                            "description": "string",
                            "estimated_cost": "string decimal",
                            "order_index": "integer >= 0",
                            "poi_id": "integer or null (must match an id from available_pois)",
                            "start_time": "HH:MM or null",
                            "end_time": "HH:MM or null",
                        }
                    ],
                }
            ],
            "metadata": {"generator": "gemini", "notes": "free-form object"},
        }

        # Se houver template ativo no banco, usa como header customizavel.
        template_header = ""
        if prompt_template and prompt_template.template:
            template_header = prompt_template.template.strip() + "\n\n"

        return (
            f"{template_header}"
            "Generate a personalized day-by-day travel itinerary for the trip below.\n\n"
            "Rules:\n"
            f"- Produce exactly {itinerary.duration_days} day(s).\n"
            "- Use 3 to 5 events per day, ordered chronologically with order_index starting at 0.\n"
            "- Each event must reference a poi_id from the available_pois list when applicable, "
            "or set poi_id to null for transit/free time blocks.\n"
            "- Respect the traveler's budget range; sum of event costs per day should be coherent.\n"
            "- Respect dietary, accessibility and interest preferences.\n"
            "- Costs must be plain decimal strings in the trip currency, no symbols.\n"
            "- Respond with a SINGLE JSON object matching this schema:\n"
            f"{json.dumps(schema_hint, indent=2)}\n\n"
            "Context:\n"
            f"{json.dumps(context, ensure_ascii=False, indent=2)}\n"
        )

    # -- call --------------------------------------------------------------

    def generate(
        self,
        *,
        itinerary: Itinerary,
        profile: TravelerDNAProfile | None,
        preferences: UserTripPreference | None,
        pois: list[PointOfInterest],
        prompt_template: PromptTemplate | None,
    ) -> dict:
        from google.api_core import exceptions as google_exceptions

        user_prompt = self._build_user_prompt(
            itinerary=itinerary,
            profile=profile,
            preferences=preferences,
            pois=pois,
            prompt_template=prompt_template,
        )

        model = self._genai.GenerativeModel(
            model_name=self._model_name,
            system_instruction=self.DEFAULT_SYSTEM_PROMPT,
            generation_config={
                "temperature": 0.7,
                "response_mime_type": "application/json",
            },
        )

        try:
            response = model.generate_content(
                user_prompt,
                request_options={"timeout": GEMINI_TIMEOUT_SECONDS},
            )
        except google_exceptions.ResourceExhausted as exc:
            raise ItineraryGenerationError("LLM rate limit exceeded.") from exc
        except google_exceptions.DeadlineExceeded as exc:
            raise ItineraryGenerationError("LLM request timed out.") from exc
        except google_exceptions.ServiceUnavailable as exc:
            raise ItineraryGenerationError("Could not reach LLM provider.") from exc
        except google_exceptions.GoogleAPIError as exc:
            raise ItineraryGenerationError(f"LLM provider error: {exc}") from exc

        # Gemini pode bloquear a resposta por safety filters; trata isso explicitamente.
        if not getattr(response, "candidates", None):
            block_reason = getattr(getattr(response, "prompt_feedback", None), "block_reason", None)
            raise ItineraryGenerationError(
                f"LLM returned no content (blocked: {block_reason})."
                if block_reason
                else "LLM returned no content."
            )

        raw_content = (response.text or "").strip()
        try:
            parsed = json.loads(raw_content)
        except json.JSONDecodeError as exc:
            logger.exception("Failed to parse LLM output as JSON: %s", raw_content[:500])
            raise ItineraryGenerationError("LLM returned invalid JSON.") from exc

        normalized = self._normalize_output(parsed, itinerary=itinerary, preferences=preferences, pois=pois)

        usage = getattr(response, "usage_metadata", None)
        normalized["metadata"] = {
            **normalized.get("metadata", {}),
            "generator": "gemini",
            "model": self._model_name,
            "template_key": getattr(prompt_template, "key", None),
            "poi_count": len(pois),
            "gemini_usage": {
                "prompt_token_count": getattr(usage, "prompt_token_count", None),
                "candidates_token_count": getattr(usage, "candidates_token_count", None),
                "total_token_count": getattr(usage, "total_token_count", None),
            } if usage else None,
        }
        return normalized

    # -- output normalization ---------------------------------------------

    def _coerce_decimal(self, value, default="0") -> str:
        try:
            return str(Decimal(str(value)))
        except (InvalidOperation, TypeError, ValueError):
            return str(Decimal(default))

    def _normalize_output(
        self,
        payload: dict,
        *,
        itinerary: Itinerary,
        preferences: UserTripPreference | None,
        pois: list[PointOfInterest],
    ) -> dict:
        valid_poi_ids = {poi.id for poi in pois}

        if not isinstance(payload, dict):
            raise ItineraryGenerationError("LLM output is not a JSON object.")

        days = payload.get("days")
        if not isinstance(days, list) or not days:
            raise ItineraryGenerationError("LLM output is missing 'days'.")

        normalized_days = []
        for day_index, day in enumerate(days, start=1):
            if not isinstance(day, dict):
                continue
            events_in = day.get("events") or []
            normalized_events = []
            for event_index, event in enumerate(events_in):
                if not isinstance(event, dict):
                    continue
                poi_id = event.get("poi_id")
                if poi_id is not None and poi_id not in valid_poi_ids:
                    # IA inventou um POI: descarta o vinculo mas mantem o evento.
                    poi_id = None
                normalized_events.append(
                    {
                        "title": str(event.get("title", "")).strip() or f"Activity {event_index + 1}",
                        "description": str(event.get("description", "")).strip(),
                        "estimated_cost": self._coerce_decimal(event.get("estimated_cost", "0")),
                        "order_index": int(event.get("order_index", event_index) or event_index),
                        "poi_id": poi_id,
                        "start_time": event.get("start_time") or None,
                        "end_time": event.get("end_time") or None,
                    }
                )
            normalized_days.append(
                {
                    "title": str(day.get("title", f"Day {day_index}")).strip(),
                    "summary": str(day.get("summary", "")).strip(),
                    "events": normalized_events,
                }
            )

        currency = (
            payload.get("currency_code")
            or getattr(preferences, "currency_code", None)
            or itinerary.currency_code
        )
        return {
            "title": str(payload.get("title") or itinerary.title or itinerary.destination.name).strip(),
            "summary": str(payload.get("summary", "")).strip(),
            "currency_code": currency,
            "estimated_cost": self._coerce_decimal(payload.get("estimated_cost", "0")),
            "days": normalized_days,
            "metadata": payload.get("metadata", {}) if isinstance(payload.get("metadata"), dict) else {},
        }


def get_generator() -> BaseItineraryGenerator:
    api_key = getattr(settings, "GEMINI_API_KEY", "") or getattr(settings, "LLM_API_KEY", "")
    model = getattr(settings, "GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
    if api_key:
        try:
            return GeminiItineraryGenerator(api_key=api_key, model=model)
        except Exception:  # pragma: no cover - falha de import do SDK
            logger.exception("Failed to initialize Gemini generator, falling back to mock.")
    return MockItineraryGenerator()


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class ItineraryGenerationService:
    def create_job(self, *, itinerary: Itinerary, user) -> LLMJob:
        model = LLMModel.objects.filter(is_default=True, is_active=True).select_related("provider").first()
        template = PromptTemplate.objects.filter(key="itinerary-generation", is_active=True).first()
        job = LLMJob.objects.create(
            user=user,
            itinerary=itinerary,
            destination=itinerary.destination,
            llm_model=model,
            prompt_template=template,
            request_payload={"itinerary_id": itinerary.id, "destination_id": itinerary.destination_id},
            status="queued",
        )
        LLMJobLog.objects.create(llm_job=job, message="Job queued.")
        return job

    def run_job(self, job: LLMJob) -> LLMJob:
        """
        Executa o job de geracao. Em caso de falha, marca job e itinerario como 'failed'
        e registra logs sem propagar a excecao para o caller (a view).
        """
        itinerary = job.itinerary
        if not itinerary:
            self._fail_job(job, itinerary=None, message="Missing itinerary on job.")
            return job

        job.status = "running"
        job.save(update_fields=["status", "updated_at"])
        LLMJobLog.objects.create(llm_job=job, message="Job started.")

        try:
            result = self._generate(job=job, itinerary=itinerary)
        except ItineraryGenerationError as exc:
            self._fail_job(job, itinerary=itinerary, message=str(exc))
            return job
        except Exception as exc:  # pragma: no cover - safety net
            logger.exception("Unexpected error during itinerary generation.")
            self._fail_job(job, itinerary=itinerary, message=f"Unexpected error: {exc}")
            return job

        self._persist_result(job=job, itinerary=itinerary, result=result)
        return job

    # -- helpers -----------------------------------------------------------

    def _generate(self, *, job: LLMJob, itinerary: Itinerary) -> dict:
        profile = TravelerDNAProfile.objects.filter(user=job.user).first()
        preferences = UserTripPreference.objects.filter(user=job.user).first()
        pois = list(
            PointOfInterest.objects.filter(destination=itinerary.destination)
            .prefetch_related("tags")
            .order_by("-rating", "name")
        )
        return get_generator().generate(
            itinerary=itinerary,
            profile=profile,
            preferences=preferences,
            pois=pois,
            prompt_template=job.prompt_template,
        )

    @transaction.atomic
    def _persist_result(self, *, job: LLMJob, itinerary: Itinerary, result: dict) -> None:
        itinerary.title = result["title"] or itinerary.title
        itinerary.summary = result["summary"]
        itinerary.budget_total = Decimal(result["estimated_cost"])
        itinerary.currency_code = result["currency_code"]
        itinerary.generation_status = "ready"
        itinerary.generation_context = {
            **(itinerary.generation_context or {}),
            **result.get("metadata", {}),
        }
        itinerary.save()
        itinerary.days.all().delete()

        for day_index, day_data in enumerate(result["days"], start=1):
            events = day_data["events"]
            day_total = sum((Decimal(event["estimated_cost"]) for event in events), Decimal("0"))
            day = ItineraryDay.objects.create(
                itinerary=itinerary,
                day_number=day_index,
                title=day_data["title"],
                summary=day_data["summary"],
                estimated_cost=day_total,
            )
            for event in events:
                ItineraryDailyEvent.objects.create(
                    itinerary_day=day,
                    poi_id=event.get("poi_id"),
                    title=event["title"],
                    description=event["description"],
                    estimated_cost=Decimal(event["estimated_cost"]),
                    order_index=event["order_index"],
                    start_time=event.get("start_time") or None,
                    end_time=event.get("end_time") or None,
                )

        job.status = "completed"
        job.response_payload = result
        job.save(update_fields=["status", "response_payload", "updated_at"])
        LLMJobLog.objects.create(llm_job=job, message="Job completed.", payload=result.get("metadata", {}))

    def _fail_job(self, job: LLMJob, *, itinerary: Itinerary | None, message: str) -> None:
        job.status = "failed"
        job.error_message = message
        job.save(update_fields=["status", "error_message", "updated_at"])
        LLMJobLog.objects.create(llm_job=job, level="error", message=message)
        if itinerary is not None:
            itinerary.generation_status = "failed"
            itinerary.save(update_fields=["generation_status", "updated_at"])