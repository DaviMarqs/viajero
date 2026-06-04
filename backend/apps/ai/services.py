from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.conf import settings
from django.db import transaction

from apps.destinations.models import Destination, PointOfInterest
from apps.itineraries.models import Itinerary, ItineraryDailyEvent, ItineraryDay
from apps.profiles.models import TravelerDNAProfile, UserTripPreference

from .generators.itinerary_helpers import apply_budget_precision, parse_cost
from .models import LLMJob, LLMJobLog, LLMModel, PromptTemplate


@dataclass
class GeneratedDay:
    title: str
    summary: str
    events: list[dict]


class BaseItineraryGenerator:
    def generate(self, *, itinerary: Itinerary, profile: TravelerDNAProfile | None, preferences: UserTripPreference | None, pois: list[PointOfInterest], prompt_template: PromptTemplate | None) -> dict:
        raise NotImplementedError


class MockItineraryGenerator(BaseItineraryGenerator):
    def generate(self, *, itinerary: Itinerary, profile: TravelerDNAProfile | None, preferences: UserTripPreference | None, pois: list[PointOfInterest], prompt_template: PromptTemplate | None) -> dict:
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


def get_generator() -> BaseItineraryGenerator:
    provider = getattr(settings, "DEFAULT_LLM_PROVIDER", "mock")
    if provider == "gemini" and settings.GEMINI_API_KEY:
        from apps.ai.generators.itinerary import GeminiItineraryGenerator
        return GeminiItineraryGenerator()
    if provider == "groq" and settings.GROQ_API_KEY:
        from apps.ai.generators.itinerary_groq import GroqItineraryGenerator
        return GroqItineraryGenerator()
    # Auto-fallback: se gemini setado mas sem key, tenta groq
    if provider == "gemini" and not settings.GEMINI_API_KEY and settings.GROQ_API_KEY:
        from apps.ai.generators.itinerary_groq import GroqItineraryGenerator
        return GroqItineraryGenerator()
    return MockItineraryGenerator()


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

    @transaction.atomic
    def run_job(self, job: LLMJob) -> LLMJob:
        itinerary = job.itinerary
        if not itinerary:
            job.status = "failed"
            job.error_message = "Missing itinerary."
            job.save(update_fields=["status", "error_message", "updated_at"])
            return job

        job.status = "running"
        job.save(update_fields=["status", "updated_at"])
        LLMJobLog.objects.create(llm_job=job, message="Job started.")

        profile = TravelerDNAProfile.objects.filter(user=job.user).first()
        preferences = UserTripPreference.objects.filter(user=job.user).first()
        pois = list(PointOfInterest.objects.filter(destination=itinerary.destination).order_by("-rating", "name"))
        result = get_generator().generate(
            itinerary=itinerary,
            profile=profile,
            preferences=preferences,
            pois=pois,
            prompt_template=job.prompt_template,
        )

        result = apply_budget_precision(result, preferences)

        itinerary.title = result["title"]
        itinerary.summary = result["summary"]
        itinerary.budget_total = Decimal(result["estimated_cost"])
        itinerary.currency_code = result["currency_code"]
        itinerary.generation_status = "ready"
        itinerary.generation_context = {
            "profile_id": getattr(profile, "id", None),
            "preferences_id": getattr(preferences, "id", None),
            **result["metadata"],
        }
        itinerary.save()
        itinerary.days.all().delete()

        for day_index, day_data in enumerate(result["days"], start=1):
            events = day_data.get("events") or []
            day = ItineraryDay.objects.create(
                itinerary=itinerary,
                day_number=day_index,
                title=day_data["title"],
                summary=day_data.get("summary", ""),
                estimated_cost=Decimal(
                    day_data.get("estimated_cost")
                    or str(sum((parse_cost(event["estimated_cost"]) for event in events), Decimal("0.00")))
                ),
            )
            for event in events:
                ItineraryDailyEvent.objects.create(
                    itinerary_day=day,
                    title=event["title"],
                    description=event["description"],
                    estimated_cost=parse_cost(event["estimated_cost"]),
                    order_index=event["order_index"],
                    poi_id=event.get("poi_id"),
                )

        job.status = "completed"
        job.response_payload = result
        job.save(update_fields=["status", "response_payload", "updated_at"])
        LLMJobLog.objects.create(llm_job=job, message="Job completed.", payload=result["metadata"])
        return job

