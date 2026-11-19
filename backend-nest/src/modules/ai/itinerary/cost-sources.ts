import type { GeneratedItinerary } from '../itinerary-generators';
import { formatCost, parseCost } from './itinerary-costs';
import type { CostBenchmarks, CostSource } from './itinerary-details';

type Event = GeneratedItinerary['days'][number]['events'][number];

export interface CostSourceContext {
  benchmarks?: CostBenchmarks;
  /** Pagina de onde o guia tirou os custos de referencia (Wikivoyage); sem ela, e media da IA. */
  benchmarksSource?: string;
  /** Ingresso estimado de cada POI (analise dos POIs). */
  ticketByPoi?: Map<number, number>;
  /** Diaria do hotel escolhido no plano. */
  nightlyCost?: number;
  /** Pessoas no grupo: refeicoes, passagens e ingressos de referencia sao por pessoa. */
  travelers?: number;
}

const PER_PERSON = new Set(['meal_budget', 'meal_mid', 'meal_high', 'public_transport_ride', 'attraction_ticket', 'poi_ticket']);

const ESTIMATE: CostSource = { basis: 'estimate', label: 'Média estimada pela IA' };

const hostLabel = (url: string) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host.includes('wikivoyage') ? 'Wikivoyage' : host;
  } catch {
    return 'fonte externa';
  }
};

/** Origem do valor de um evento a partir do `cost_basis` que o LLM informou, validado contra os dados reais. */
export function resolveCostSource(event: Event, ctx: CostSourceContext): CostSource {
  const cost = parseCost(event.estimated_cost);
  const details = event.details ?? {};
  if (cost === 0) return { basis: 'free', label: details.kind === 'lodging' ? 'Sem diária neste dia' : 'Gratuito ou sem custo previsto' };

  const benchmarkLabel = ctx.benchmarksSource ? `Referência do guia (${hostLabel(ctx.benchmarksSource)})` : 'Média estimada pela IA';
  const travelers = ctx.travelers && ctx.travelers > 1 ? ctx.travelers : undefined;
  const perPerson = (source: CostSource): CostSource => (travelers && PER_PERSON.has(source.basis) ? { ...source, travelers } : source);
  const withSource = (source: CostSource): CostSource => perPerson(ctx.benchmarksSource ? { ...source, source_url: ctx.benchmarksSource } : source);

  if (details.kind === 'lodging') {
    const reference = ctx.nightlyCost && ctx.nightlyCost > 0 ? ctx.nightlyCost : parseCost(ctx.benchmarks?.hotel_night);
    if (reference > 0) {
      const label = ctx.benchmarksSource ? `Diária do hotel do plano · ${benchmarkLabel}` : 'Diária do hotel do plano · média estimada pela IA';
      return withSource({ basis: 'hotel_night', label, reference: formatCost(reference) });
    }
    return ESTIMATE;
  }

  const basis = details.cost_basis;
  if (basis === 'poi_ticket' || (!basis && event.poi_id !== undefined)) {
    const ticket = event.poi_id !== undefined ? ctx.ticketByPoi?.get(event.poi_id) : undefined;
    if (ticket && ticket > 0) return perPerson({ basis: 'poi_ticket', label: 'Ingresso estimado na análise do local', reference: formatCost(ticket) });
  }
  if (basis && basis !== 'estimate' && basis !== 'poi_ticket') {
    const reference = parseCost(ctx.benchmarks?.[basis]);
    if (reference > 0) return withSource({ basis, label: benchmarkLabel, reference: formatCost(reference) });
  }
  return ESTIMATE;
}

/** Preenche `details.cost_source` de todos os eventos. */
export function applyCostSources(result: GeneratedItinerary, ctx: CostSourceContext): void {
  for (const day of result.days) {
    for (const event of day.events) {
      event.details = { ...(event.details ?? {}), cost_source: resolveCostSource(event, ctx) };
    }
  }
}
