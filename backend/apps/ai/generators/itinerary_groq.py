"""Gerador de roteiro via Groq."""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings

from apps.ai.models import PromptTemplate
from apps.ai.providers.base import LLMProviderError, LLMResponseError
from apps.ai.providers.groq import GroqProvider
from apps.ai.services import BaseItineraryGenerator
from apps.destinations.models import PointOfInterest
from apps.itineraries.models import Itinerary
from apps.profiles.models import TravelerDNAProfile, UserTripPreference

from .itinerary_helpers import (
    ITINERARY_SCHEMA,
    build_context,
    build_prompt,
    normalize_payload,
    reinforce_prompt,
)


logger = logging.getLogger(__name__)


class GroqItineraryGenerator(BaseItineraryGenerator):
    """Espelha GeminiItineraryGenerator usando GroqProvider."""

    def __init__(self, provider: GroqProvider | None = None) -> None:
        self._provider = provider or GroqProvider()

    def generate(
        self,
        *,
        itinerary: Itinerary,
        profile: TravelerDNAProfile | None,
        preferences: UserTripPreference | None,
        pois: list[PointOfInterest],
        prompt_template: PromptTemplate | None,
    ) -> dict[str, Any]:
        context = build_context(itinerary, profile, preferences, pois)
        prompt = build_prompt(context, prompt_template)

        for attempt in (1, 2):
            try:
                payload = self._provider.generate_json(
                    prompt,
                    ITINERARY_SCHEMA,
                    timeout=settings.GROQ_ITINERARY_TIMEOUT,
                )
            except LLMResponseError as exc:
                logger.warning("Groq itinerary attempt %d response error: %s", attempt, exc)
                if attempt == 2:
                    raise
                prompt = reinforce_prompt(prompt)
                continue
            except LLMProviderError:
                raise

            normalized = normalize_payload(payload, itinerary, pois)
            normalized["metadata"]["generator"] = "groq"
            normalized["metadata"]["model"] = settings.GROQ_MODEL
            return normalized

        raise LLMResponseError("Groq nao retornou roteiro valido apos retries")
