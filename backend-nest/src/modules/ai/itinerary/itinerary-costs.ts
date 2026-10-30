import type { GeneratedItinerary } from '../itinerary-generators';

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Converte um custo vindo do LLM em numero (2 casas). Aceita numeros e strings com simbolo de moeda,
 * separador de milhar e virgula decimal ("R$ 1.200,50", "120 reais", "80.00"). Devolve 0 quando nao entende.
 */
export function parseCost(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? round2(Math.abs(value)) : 0;

  let text = String(value).replace(/[^0-9.,-]/g, '').trim();
  if (!text || ['-', '.', ','].includes(text)) return 0;

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');
  if (hasComma && hasDot) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (hasComma) {
    text = text.replace(',', '.');
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? round2(Math.abs(parsed)) : 0;
}

export const formatCost = (value: number) => round2(value).toFixed(2);

export interface BudgetRange {
  budget_min?: unknown;
  budget_max?: unknown;
  currency_code?: string | null;
}

/**
 * Deixa os valores consistentes e dentro da faixa de orcamento (paridade com o Django):
 * - custo do dia = soma dos eventos; total = soma dos dias (nao confia no total do LLM);
 * - fora da faixa [budget_min, budget_max], reescala os eventos para o limite mais proximo;
 * - moeda vem das preferencias da viagem.
 */
export function applyBudgetPrecision(result: GeneratedItinerary, preferences: BudgetRange | null): GeneratedItinerary {
  const events = () => result.days.flatMap((day) => day.events);
  let total = events().reduce((sum, event) => sum + parseCost(event.estimated_cost), 0);

  if (preferences) {
    const budgetMin = parseCost(preferences.budget_min);
    const budgetMax = parseCost(preferences.budget_max);
    let target: number | null = null;
    if (budgetMax > 0 && total > budgetMax) target = budgetMax;
    else if (budgetMin > 0 && total < budgetMin) target = budgetMin;

    if (target !== null && total > 0) {
      const factor = target / total;
      for (const event of events()) event.estimated_cost = formatCost(parseCost(event.estimated_cost) * factor);
      total = target;
    }
  }

  let grandTotal = 0;
  for (const day of result.days) {
    let dayTotal = 0;
    for (const event of day.events) {
      const cost = parseCost(event.estimated_cost);
      event.estimated_cost = formatCost(cost);
      dayTotal += cost;
    }
    day.estimated_cost = formatCost(dayTotal);
    grandTotal += dayTotal;
  }

  result.estimated_cost = formatCost(grandTotal);
  if (preferences?.currency_code) result.currency_code = preferences.currency_code;
  return result;
}
