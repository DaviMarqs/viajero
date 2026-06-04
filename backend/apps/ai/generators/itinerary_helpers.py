"""Helpers compartilhados entre geradores de roteiro (Gemini, Groq, etc)."""
from __future__ import annotations

import json
import logging
import re
from decimal import Decimal, InvalidOperation
from typing import Any

from apps.destinations.models import PointOfInterest
from apps.itineraries.models import Itinerary
from apps.profiles.models import TravelerDNAProfile, UserTripPreference


logger = logging.getLogger(__name__)

_CENTS = Decimal("0.01")
_NON_NUMERIC_RE = re.compile(r"[^0-9.,-]")


def parse_cost(value: Any) -> Decimal:
    """Converte um custo vindo do LLM em Decimal robusto.

    Aceita numeros, strings com simbolos de moeda, separadores de milhar e
    virgula decimal (ex: "R$ 1.200,50", "120 reais", "80.00"). Devolve
    Decimal("0.00") quando nao consegue interpretar.
    """
    if value is None:
        return Decimal("0.00")
    if isinstance(value, (int, float, Decimal)):
        try:
            return Decimal(str(value)).quantize(_CENTS)
        except (InvalidOperation, ValueError):
            return Decimal("0.00")

    text = _NON_NUMERIC_RE.sub("", str(value)).strip()
    if not text or text in {"-", ".", ","}:
        return Decimal("0.00")

    has_comma = "," in text
    has_dot = "." in text
    if has_comma and has_dot:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif has_comma:
        text = text.replace(",", ".")

    try:
        parsed = Decimal(text)
    except (InvalidOperation, ValueError):
        return Decimal("0.00")
    if parsed < 0:
        parsed = -parsed
    return parsed.quantize(_CENTS)


def apply_budget_precision(
    result: dict[str, Any],
    preferences: UserTripPreference | None,
) -> dict[str, Any]:
    """Torna os valores consistentes e dentro da faixa de orcamento.

    - Recalcula o custo de cada dia como a soma dos eventos.
    - Recalcula o total como a soma dos dias (nao confia no total do LLM).
    - Se houver faixa de orcamento, reescala os custos para o total cair
      dentro de [budget_min, budget_max], usando o limite mais proximo.
    - Define a moeda a partir das preferencias quando disponivel.
    """
    days = result.get("days") or []

    total = Decimal("0.00")
    for day in days:
        day_total = sum((parse_cost(ev.get("estimated_cost")) for ev in day.get("events") or []), Decimal("0.00"))
        total += day_total

    if preferences is not None:
        budget_min = parse_cost(preferences.budget_min)
        budget_max = parse_cost(preferences.budget_max)
        target: Decimal | None = None
        if budget_max > 0 and total > budget_max:
            target = budget_max
        elif budget_min > 0 and total < budget_min:
            target = budget_min

        if target is not None and total > 0:
            factor = target / total
            for day in days:
                for ev in day.get("events") or []:
                    scaled = (parse_cost(ev.get("estimated_cost")) * factor).quantize(_CENTS)
                    ev["estimated_cost"] = str(scaled)
            total = target

    grand_total = Decimal("0.00")
    for day in days:
        day_total = Decimal("0.00")
        for ev in day.get("events") or []:
            cost = parse_cost(ev.get("estimated_cost"))
            ev["estimated_cost"] = str(cost)
            day_total += cost
        day["estimated_cost"] = str(day_total)
        grand_total += day_total

    result["estimated_cost"] = str(grand_total)
    if preferences is not None and getattr(preferences, "currency_code", None):
        result["currency_code"] = preferences.currency_code
    return result


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


def build_context(
    itinerary: Itinerary,
    profile: TravelerDNAProfile | None,
    preferences: UserTripPreference | None,
    pois: list[PointOfInterest],
) -> dict[str, Any]:
    ranked = sorted(pois, key=lambda p: (-(p.rating or 0), p.name))[:30]
    context: dict[str, Any] = {
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
        "pois": [
            {"id": p.id, "name": p.name, "type": p.poi_type, "rating": str(p.rating)}
            for p in ranked
        ],
    }
    if profile:
        context["profile"] = {
            "travel_style": getattr(profile, "travel_style", "flexivel"),
            "pace": getattr(profile, "pace", "balanced"),
        }
    if preferences:
        context["preferences"] = {
            "budget_min": str(preferences.budget_min),
            "budget_max": str(preferences.budget_max),
            "currency_code": preferences.currency_code,
            "preferred_trip_length_days": preferences.preferred_trip_length_days,
            "hotel_level": preferences.hotel_level or None,
            "transportation_style": preferences.transportation_style or None,
            "dietary_preferences": list(preferences.dietary_preferences or []),
            "accessibility_needs": list(preferences.accessibility_needs or []),
            "interests": list(preferences.interests or []),
        }
    return context


def build_prompt(context: dict[str, Any], prompt_template) -> str:
    currency = context["currency_code"]
    # Ancoras de orcamento so entram no prompt quando ha valor real (> 0).
    # Injetar "0.00" / faixa ausente faz o LLM devolver todos os custos zerados.
    budget_total = parse_cost(context.get("budget_total"))
    prefs_hint = ""
    budget_rule = ""

    prefs = context.get("preferences")
    budget_min = parse_cost(prefs.get("budget_min")) if prefs else Decimal("0.00")
    budget_max = parse_cost(prefs.get("budget_max")) if prefs else Decimal("0.00")

    if prefs:
        p = prefs
        budget_hint = ""
        if budget_min > 0 or budget_max > 0:
            budget_hint = f" Orcamento entre {p['budget_min']} e {p['budget_max']} {p['currency_code']}."
        prefs_hint = (
            f"{budget_hint}"
            f" Interesses: {', '.join(p['interests']) or 'nao informados'}."
            f" Estilo de hospedagem: {p.get('hotel_level') or 'nao informado'}."
            f" Restricoes alimentares: {', '.join(p['dietary_preferences']) or 'nenhuma'}."
        )
        if budget_min > 0 or budget_max > 0:
            budget_rule = (
                f" REGRA DE ORCAMENTO: a soma de TODOS os estimated_cost deve ficar "
                f"OBRIGATORIAMENTE entre {p['budget_min']} e {p['budget_max']} {p['currency_code']}."
            )

    if not budget_rule and budget_total > 0:
        budget_rule = (
            f" O CUSTO TOTAL (soma de todos os eventos) deve ficar proximo de "
            f"{context['budget_total']} {currency}."
        )

    orcamento_line = (
        f" Orcamento total: {context['budget_total']} {currency}." if budget_total > 0 else ""
    )

    intro = (
        "Voce e um planejador de viagens. "
        f"Crie um roteiro de EXATAMENTE {context['duration_days']} dias para "
        f"{context['destination']['name']} ({context['destination']['country']})."
        f"{orcamento_line}"
        f"{prefs_hint}"
        " Prefira eventos que referenciem POIs existentes via 'poi_id'. "
        "Inclua tambem eventos de hospedagem (por dia), refeicoes e transporte "
        "com poi_id=null para que o custo seja realista. "
        "Cada dia deve ter entre 3 e 6 eventos."
        f"{budget_rule}"
        " REGRAS DE VALOR: cada 'estimated_cost' (de cada evento e do roteiro) "
        f"deve ser um numero decimal em {currency}, no formato '1234.56', "
        "SEM simbolo de moeda, SEM separador de milhar e SEM texto. "
        "Use estimativas realistas de mercado para o destino."
    )
    if prompt_template and getattr(prompt_template, "template", ""):
        intro = f"{intro}\n\nTemplate adicional:\n{prompt_template.template}"

    # Mesmo motivo do gate acima: "budget_total": "0.00" no JSON do contexto
    # tambem ancora o LLM em custos zerados. Remove quando nao ha orcamento.
    context_for_dump = context
    if budget_total <= 0:
        context_for_dump = {k: v for k, v in context.items() if k != "budget_total"}

    return f"{intro}\n\nContexto:\n{json.dumps(context_for_dump, ensure_ascii=False)}"


def reinforce_prompt(prompt: str) -> str:
    return (
        f"{prompt}\n\n"
        "IMPORTANTE: Sua resposta anterior nao era JSON valido. "
        "Responda APENAS com JSON, sem texto antes ou depois."
    )


def normalize_payload(
    payload: dict[str, Any],
    itinerary: Itinerary,
    pois: list[PointOfInterest],
) -> dict[str, Any]:
    valid_poi_ids = set(
        PointOfInterest.objects.filter(
            destination=itinerary.destination,
            id__in=_collect_poi_ids(payload),
        ).values_list("id", flat=True)
    )

    days_out = []
    for day in payload.get("days") or []:
        events_out = []
        for event in day.get("events") or []:
            poi_id = event.get("poi_id")
            if poi_id is not None and poi_id not in valid_poi_ids:
                logger.warning(
                    "Generator referenciou poi_id=%s invalido para destino=%s; descartando FK",
                    poi_id,
                    itinerary.destination_id,
                )
                poi_id = None
            events_out.append(
                {
                    "poi_id": poi_id,
                    "title": str(event.get("title") or "")[:160],
                    "description": str(event.get("description") or "")[:4000],
                    "estimated_cost": str(parse_cost(event.get("estimated_cost"))),
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
        "estimated_cost": str(parse_cost(payload.get("estimated_cost"))),
        "currency_code": str(payload.get("currency_code") or itinerary.currency_code),
        "days": days_out,
        "metadata": {
            "generator": "unknown",  # overridden by caller
            "model": "",  # overridden by caller
            "poi_count": len(pois),
        },
    }


def _collect_poi_ids(payload: dict[str, Any]) -> list[int]:
    ids: list[int] = []
    for day in payload.get("days") or []:
        for event in day.get("events") or []:
            poi_id = event.get("poi_id")
            if isinstance(poi_id, int):
                ids.append(poi_id)
    return ids
