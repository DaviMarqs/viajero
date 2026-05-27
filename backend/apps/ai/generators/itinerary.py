"""Gerador de roteiro via Gemini."""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings

from apps.ai.models import PromptTemplate
from apps.ai.providers.base import LLMProviderError, LLMResponseError
from apps.ai.providers.gemini import GeminiProvider
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

# Re-export for backward compat (tests import ITINERARY_SCHEMA from here)
__all__ = ["GeminiItineraryGenerator", "ITINERARY_SCHEMA"]


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
        context = build_context(itinerary, profile, preferences, pois)
        prompt = build_prompt(context, prompt_template)

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
                prompt = reinforce_prompt(prompt)
                continue
            except LLMProviderError:
                raise

            normalized = normalize_payload(payload, itinerary, pois)
            normalized["metadata"]["generator"] = "gemini"
            normalized["metadata"]["model"] = settings.GEMINI_MODEL
            return normalized

        raise LLMResponseError("Gemini nao retornou roteiro valido apos retries")

    # ---------------------------------------------------------------------------
    # Backward-compat wrappers (used by tests and legacy call sites)
    # ---------------------------------------------------------------------------

    def _build_context(
        self,
        itinerary: Itinerary,
        profile: TravelerDNAProfile | None,
        preferences: UserTripPreference | None,
        pois: list[PointOfInterest],
    ) -> dict[str, Any]:
        return build_context(itinerary, profile, preferences, pois)

    def _build_prompt(self, context: dict[str, Any], prompt_template) -> str:
        return build_prompt(context, prompt_template)

    def _reinforce_prompt(self, prompt: str) -> str:
        return reinforce_prompt(prompt)

    def _normalize_payload(
        self,
        payload: dict[str, Any],
        itinerary: Itinerary,
        pois: list[PointOfInterest],
    ) -> dict[str, Any]:
        return normalize_payload(payload, itinerary, pois)
