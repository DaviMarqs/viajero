"""Sugere um destino com base no perfil/preferencias do usuario via Groq.

Diferente do enricher (que enriquece um destino ja conhecido), aqui o LLM
ESCOLHE um destino para o usuario sem que ele digite nada. Usa TravelerDNA +
UserTripPreference como contexto.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from django.conf import settings

from apps.ai.providers.base import LLMProviderError, LLMResponseError
from apps.ai.providers.groq import GroqProvider
from apps.profiles.models import TravelerDNAProfile, UserTripPreference


logger = logging.getLogger(__name__)


SUGGESTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "destination_name": {"type": "string"},
        "country": {"type": "string"},
        "city": {"type": "string"},
        "rationale": {"type": "string"},
    },
    "required": ["destination_name"],
}


@dataclass
class DestinationSuggestion:
    name: str = ""
    country: str = ""
    city: str = ""
    rationale: str = ""

    def is_valid(self) -> bool:
        return bool(self.name.strip())


class DestinationSuggestionService:
    """Escolhe um destino para o usuario. Sem persistir nada."""

    def __init__(self, provider: GroqProvider | None = None) -> None:
        self._provider = provider

    def _get_provider(self) -> GroqProvider:
        if self._provider is None:
            self._provider = GroqProvider()
        return self._provider

    def suggest(self, user) -> DestinationSuggestion | None:
        if not settings.GROQ_API_KEY:
            logger.info("Sugestao de destino indisponivel: GROQ_API_KEY ausente")
            return None

        profile = TravelerDNAProfile.objects.filter(user=user).first()
        preferences = UserTripPreference.objects.filter(user=user).first()
        already_suggested = self._already_suggested_destinations(user)
        prompt = self._build_prompt(profile, preferences, already_suggested)

        payload = self._call_with_retry(prompt)
        if payload is None:
            return None

        suggestion = DestinationSuggestion(
            name=str(payload.get("destination_name") or "").strip()[:150],
            country=str(payload.get("country") or "").strip()[:100],
            city=str(payload.get("city") or "").strip()[:100],
            rationale=str(payload.get("rationale") or "").strip()[:500],
        )
        if not suggestion.is_valid():
            logger.info("Groq devolveu sugestao sem nome de destino")
            return None
        return suggestion

    def _already_suggested_destinations(self, user) -> list[str]:
        """Nomes de destinos que o usuario ja tem roteiro gerado/em geracao.

        Evita repetir sempre os mesmos destinos na sugestao automatica.
        """
        from apps.itineraries.models import Itinerary

        names = (
            Itinerary.objects.filter(user=user)
            .values_list("destination__name", flat=True)
            .distinct()
        )
        seen: list[str] = []
        for name in names:
            clean = (name or "").strip()
            if clean and clean not in seen:
                seen.append(clean)
        return seen

    def _build_prompt(
        self,
        profile: TravelerDNAProfile | None,
        preferences: UserTripPreference | None,
        already_suggested: list[str] | None = None,
    ) -> str:
        traits: list[str] = []
        if profile:
            traits.append(f"estilo de viagem: {profile.travel_style}")
            traits.append(f"ritmo: {profile.pace}")
            traits.append(f"nivel de conforto: {profile.comfort_level}")
            traits.append(
                "interesses (0-10): "
                f"aventura {profile.adventure_level}, "
                f"gastronomia {profile.food_focus}, "
                f"cultura {profile.cultural_interest}, "
                f"natureza {profile.nature_interest}, "
                f"vida noturna {profile.nightlife_interest}"
            )
        if preferences:
            traits.append(
                f"orcamento entre {preferences.budget_min} e {preferences.budget_max} "
                f"{preferences.currency_code}"
            )
            if preferences.companionship:
                traits.append(f"companhia: {preferences.companionship}")
            if preferences.travel_month:
                traits.append(f"mes pretendido: {preferences.travel_month}")
            if preferences.preferred_trip_length_days:
                traits.append(f"duracao: {preferences.preferred_trip_length_days} dias")
            if preferences.interests:
                traits.append(f"interesses declarados: {', '.join(preferences.interests)}")
            if preferences.hotel_level:
                traits.append(f"hospedagem: {preferences.hotel_level}")

        perfil_txt = "; ".join(traits) if traits else "perfil ainda nao informado"

        avoid_txt = ""
        if already_suggested:
            avoid_txt = (
                "\n\nO usuario ja tem roteiro para estes destinos, entao NAO os "
                "escolha de novo; sugira um destino DIFERENTE: "
                f"{', '.join(already_suggested)}."
            )

        return (
            "Voce e um consultor de viagens. Escolha UM unico destino real e "
            "conhecido que combine com o perfil do viajante abaixo. "
            "PRIORIZE destinos no Brasil: salvo se o perfil pedir claramente uma "
            "viagem internacional, o destino deve ser brasileiro (country='Brasil'). "
            "Considere o orcamento e a epoca quando informados. "
            "Devolva o nome do destino, pais e cidade (quando aplicavel) e uma "
            "justificativa curta em portugues.\n\n"
            f"Perfil do viajante: {perfil_txt}."
            f"{avoid_txt}"
        )

    def _call_with_retry(self, prompt: str) -> dict[str, Any] | None:
        current = prompt
        for attempt in (1, 2):
            try:
                return self._get_provider().generate_json(
                    current,
                    SUGGESTION_SCHEMA,
                    timeout=settings.GROQ_TIMEOUT,
                )
            except LLMResponseError as exc:
                logger.warning("Sugestao de destino tentativa %d falhou: %s", attempt, exc)
                if attempt == 2:
                    return None
                current = (
                    f"{prompt}\n\nIMPORTANTE: responda APENAS com JSON valido, "
                    "sem texto antes ou depois."
                )
                continue
            except LLMProviderError as exc:
                logger.warning(
                    "Sugestao de destino falhou com %s: %s", type(exc).__name__, exc
                )
                return None
        return None
