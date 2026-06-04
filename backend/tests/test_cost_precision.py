from decimal import Decimal

import pytest

from apps.ai.generators.itinerary_helpers import apply_budget_precision, parse_cost


class _FakePrefs:
    def __init__(self, budget_min, budget_max, currency_code="BRL"):
        self.budget_min = Decimal(budget_min)
        self.budget_max = Decimal(budget_max)
        self.currency_code = currency_code


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("80", Decimal("80.00")),
        ("80.50", Decimal("80.50")),
        ("R$ 1.200,50", Decimal("1200.50")),
        ("1,200.50", Decimal("1200.50")),
        ("120 reais", Decimal("120.00")),
        ("", Decimal("0.00")),
        ("abc", Decimal("0.00")),
        (None, Decimal("0.00")),
        (150, Decimal("150.00")),
        (99.9, Decimal("99.90")),
        ("-50", Decimal("50.00")),
        ("1.234,00", Decimal("1234.00")),
        ("1,5", Decimal("1.50")),
    ],
)
def test_parse_cost(raw, expected):
    assert parse_cost(raw) == expected


def _result(event_costs):
    """event_costs: list of lists (por dia)."""
    days = []
    for day_costs in event_costs:
        events = [
            {"title": f"e{i}", "description": "", "estimated_cost": c, "order_index": i}
            for i, c in enumerate(day_costs)
        ]
        days.append({"title": "dia", "summary": "", "events": events})
    return {"title": "t", "summary": "", "estimated_cost": "0", "currency_code": "USD", "days": days}


def test_apply_budget_precision_recomputes_totals_without_prefs():
    result = apply_budget_precision(_result([["100", "50"], ["30"]]), None)
    assert result["days"][0]["estimated_cost"] == "150.00"
    assert result["days"][1]["estimated_cost"] == "30.00"
    assert result["estimated_cost"] == "180.00"


def test_apply_budget_precision_clamps_when_above_max():
    result = apply_budget_precision(_result([["3000", "1000"]]), _FakePrefs("500", "2000"))
    assert result["estimated_cost"] == "2000.00"
    assert result["days"][0]["events"][0]["estimated_cost"] == "1500.00"
    assert result["days"][0]["events"][1]["estimated_cost"] == "500.00"
    assert result["currency_code"] == "BRL"


def test_apply_budget_precision_scales_up_when_below_min():
    result = apply_budget_precision(_result([["60", "40"]]), _FakePrefs("1000", "3000"))
    assert result["estimated_cost"] == "1000.00"
    assert result["days"][0]["events"][0]["estimated_cost"] == "600.00"


def test_apply_budget_precision_keeps_total_within_range():
    result = apply_budget_precision(_result([["1000", "500"]]), _FakePrefs("1000", "3000"))
    assert result["estimated_cost"] == "1500.00"
    assert result["days"][0]["events"][0]["estimated_cost"] == "1000.00"


def test_apply_budget_precision_normalizes_dirty_costs():
    result = apply_budget_precision(_result([["R$ 100,00", "abc"]]), None)
    assert result["days"][0]["events"][0]["estimated_cost"] == "100.00"
    assert result["days"][0]["events"][1]["estimated_cost"] == "0.00"
    assert result["estimated_cost"] == "100.00"
