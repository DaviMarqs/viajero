"""build_prompt nao deve ancorar o LLM em orcamento zerado/ausente.

Bug: quando budget_total=0 e sem faixa de orcamento, o prompt injetava
"Orcamento total: 0.00" e a regra "deve ficar proximo de 0.00", fazendo o
LLM devolver TODOS os custos como 0.00. Sem ancora de orcamento, o prompt
deve pedir estimativas realistas de mercado.
"""
from apps.ai.generators.itinerary_helpers import build_prompt


def _instructions(context):
    """So a parte de instrucao do prompt; o dump JSON do contexto vem depois."""
    return build_prompt(context, None).split("\n\nContexto:")[0]


def _context(budget_total="0.00", preferences=None):
    ctx = {
        "destination": {"name": "Paris", "country": "Franca", "city": "Paris", "summary": ""},
        "duration_days": 3,
        "currency_code": "BRL",
        "budget_total": budget_total,
        "pois": [],
    }
    if preferences is not None:
        ctx["preferences"] = preferences
    return ctx


def test_zero_budget_no_anchor():
    prompt = _instructions(_context(budget_total="0.00"))
    assert "0.00" not in prompt
    assert "proximo de" not in prompt
    assert "Orcamento total" not in prompt
    assert "realistas de mercado" in prompt


def test_zero_budget_not_leaked_in_context_json():
    # O JSON do contexto tambem nao pode levar "budget_total": "0.00",
    # senao o LLM copia e zera todos os custos.
    full = build_prompt(_context(budget_total="0.00"), None)
    assert "budget_total" not in full
    assert "0.00" not in full


def test_positive_budget_kept_in_context_json():
    full = build_prompt(_context(budget_total="2000.00"), None)
    assert "budget_total" in full


def test_no_budget_range_in_prefs_no_none_anchor():
    prefs = {
        "budget_min": "None",
        "budget_max": "None",
        "currency_code": "BRL",
        "preferred_trip_length_days": 3,
        "hotel_level": None,
        "transportation_style": None,
        "dietary_preferences": [],
        "accessibility_needs": [],
        "interests": [],
    }
    prompt = _instructions(_context(budget_total="0.00", preferences=prefs))
    assert "None" not in prompt
    assert "OBRIGATORIAMENTE" not in prompt
    assert "realistas de mercado" in prompt


def test_positive_budget_keeps_anchor():
    prompt = _instructions(_context(budget_total="2000.00"))
    assert "2000.00" in prompt
    assert "proximo de" in prompt


def test_positive_budget_range_keeps_rule():
    prefs = {
        "budget_min": "1000",
        "budget_max": "1500",
        "currency_code": "EUR",
        "preferred_trip_length_days": 3,
        "hotel_level": None,
        "transportation_style": None,
        "dietary_preferences": [],
        "accessibility_needs": [],
        "interests": [],
    }
    prompt = _instructions(_context(budget_total="2000.00", preferences=prefs))
    assert "OBRIGATORIAMENTE" in prompt
    assert "1000" in prompt and "1500" in prompt
