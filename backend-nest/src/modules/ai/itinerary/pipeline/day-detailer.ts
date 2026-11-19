import type { PointOfInterest } from '../../../destinations/entities';
import type { GeneratedItinerary } from '../../itinerary-generators';
import type { JsonObject } from '../../llm/llm-provider';
import { LlmResponseError } from '../../llm/llm.errors';
import { formatCost } from '../itinerary-costs';
import { COST_BASES, EVENT_KINDS, TripGuide, normalizeDayDetails } from '../itinerary-details';
import { normalizeItineraryPayload } from '../itinerary-normalizer';
import { poiForPrompt } from '../itinerary-prompt';
import type { TripPlan, PlannedDay } from './day-planner';
import type { PoiInsight } from './poi-analysis';
import { PipelineContext, runStage, sectionedPrompt, travelersOf } from './shared';

export type GeneratedDay = GeneratedItinerary['days'][number];

export const DAY_SCHEMA: JsonObject = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    area: { type: 'string' },
    rain_plan: { type: 'string' },
    alternatives: {
      type: 'array',
      maxItems: 3,
      items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, estimated_cost: { type: 'string' } }, required: ['title'] },
    },
    tips: { type: 'array', maxItems: 5, items: { type: 'string' } },
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: [...EVENT_KINDS] },
          title: { type: 'string' },
          description: { type: 'string' },
          start_time: { type: 'string' },
          end_time: { type: 'string' },
          estimated_cost: { type: 'string' },
          poi_id: { type: ['integer', 'null'] },
          place_name: { type: 'string' },
          cost_basis: { type: 'string', enum: [...COST_BASES] },
          location: { type: 'string' },
          tip: { type: 'string' },
          booking_required: { type: 'boolean' },
          booking_note: { type: 'string' },
          transit_to_next: { type: 'object', properties: { mode: { type: 'string' }, minutes: { type: 'integer' }, note: { type: 'string' } } },
          order_index: { type: 'integer' },
        },
        required: ['kind', 'title', 'description', 'start_time', 'end_time', 'estimated_cost'],
      },
    },
  },
  required: ['title', 'summary', 'events'],
};

export interface DayDetailInput {
  plan: TripPlan;
  day: PlannedDay;
  pois: PointOfInterest[];
  insights: Map<number, PoiInsight>;
  guide?: TripGuide;
  /** Temas dos outros dias, para nao repetir programa. */
  otherThemes: string[];
  /** Ha pernoite depois deste dia (todos menos o ultimo, quando a viagem tem mais de um dia). */
  hasNight: boolean;
  dayBudget: number;
  validPoiIds: Set<number>;
}

export function buildDayPrompt(ctx: PipelineContext, input: DayDetailInput): string {
  const prefs = ctx.context.preferences;
  const date = ctx.dates[input.day.day_number - 1];
  const lodging = input.plan.lodging;
  const rules = [
    'Monte de 4 a 7 eventos em ordem cronologica, com start_time/end_time HH:MM (24h), sem sobreposicao e com tempo de deslocamento entre eles.',
    'Inclua TODOS os POIs do dia (com o poi_id recebido), respeitando opening_hours, closed_days e best_time_of_day.',
    'Inclua pelo menos uma refeicao (kind=meal) em lugar real e conhecido da area, compativel com a dieta.',
    'Use kind=transport (poi_id=null) para deslocamentos pagos relevantes (metro, taxi, trem); o custo do transporte fica SO nesses eventos.',
    'transit_to_next: como ir ao proximo evento (modo, minutos, observacao). E so informativo, sem custo.',
    input.hasNight && lodging
      ? `Inclua um evento kind=lodging no fim do dia: "${lodging.suggestion ?? 'Hospedagem'}"${lodging.area ? ` em ${lodging.area}` : ''}, com estimated_cost = ${formatCost(lodging.nightly_cost)} (mesmo hotel e mesma diaria em todos os dias).`
      : input.hasNight
        ? 'Inclua um evento kind=lodging no fim do dia com a diaria realista do nivel de hospedagem pedido.'
        : 'Este e o ultimo dia: nao ha diaria de hospedagem (se quiser, um check-out com custo 0.00).',
    `Custos em ${ctx.currency}, formato '123.45', sem simbolo, para o GRUPO TODO (${travelersOf(prefs?.companionship)} pessoa(s)), ancorados nos custos de referencia.`,
    `custos_referencia sao POR PESSOA (exceto hotel_night, que e a diaria do quarto): multiplique refeicoes, passagens e ingressos por ${travelersOf(prefs?.companionship)}; taxi e diaria nao se multiplicam.`,
    input.dayBudget > 0 ? `A soma do dia deve ficar perto de ${formatCost(input.dayBudget)} ${ctx.currency}.` : 'Use estimativas realistas de mercado.',
    'tip: dica pratica curta por evento. booking_required/booking_note quando precisa reservar ou comprar antes.',
    'location: bairro ou endereco curto do evento.',
    'place_name: nome EXATO do estabelecimento ou atracao (ex.: "Pasteis de Belem", "Hotel Chiado Seed"), como aparece no Google Maps; deixe vazio se o evento for generico (ex.: "jantar em taberna do bairro", deslocamento).',
    `cost_basis: em qual referencia o custo se baseia: ${COST_BASES.join(', ')} (poi_ticket = ticket_cost do POI; estimate = sem referencia).`,
    'rain_plan: o que fazer no lugar das atividades ao ar livre se chover. alternatives: ate 3 opcoes extras na mesma area. tips: ate 5 dicas do dia.',
    `Nao repita o programa dos outros dias: ${input.otherThemes.join('; ') || 'nenhum'}.`,
    'title do dia: curto, sem "Dia N". Escreva em portugues do Brasil.',
  ];
  if (prefs?.accessibility_needs.length) rules.push(`Acessibilidade: ${prefs.accessibility_needs.join(', ')}; prefira opcoes compativeis e avise quando nao forem.`);
  return sectionedPrompt({
    role: 'Voce e um guia local que detalha um dia de viagem com horarios, custos e dicas realistas.',
    task: `Detalhe o dia ${input.day.day_number} de ${ctx.context.duration_days} da viagem para ${ctx.context.destination.name} (${ctx.context.destination.country}).`,
    data: {
      dia: { ...date, tema: input.day.theme, area: input.day.area ?? null },
      ritmo: ctx.context.profile?.pace ?? 'moderado',
      viajantes: prefs?.companionship ?? null,
      pessoas: travelersOf(prefs?.companionship),
      transporte: prefs?.transportation_style ?? null,
      dieta: prefs?.dietary_preferences ?? [],
      interesses: prefs?.interests ?? [],
      moeda: ctx.currency,
      custos_referencia: input.guide?.cost_benchmarks ?? null,
      locomocao: input.guide?.getting_around ?? null,
      clima: input.guide?.weather ?? null,
      hospedagem: lodging ?? null,
      pois: input.pois.map((poi) => ({ ...poiForPrompt(poi, 200), ...(input.insights.get(Number(poi.id)) ?? {}) })),
    },
    rules,
    output: 'Objeto JSON do dia com title, summary, area, rain_plan, alternatives, tips e events.',
    extra: ctx.input.promptTemplate?.template || undefined,
  });
}

/** Garante a hospedagem do plano: mesma diaria nos dias com pernoite e custo zero no ultimo dia. */
export function applyLodgingPolicy(day: GeneratedDay, hasNight: boolean, nightlyCost: number): void {
  for (const event of day.events) {
    if (event.details?.kind !== 'lodging') continue;
    if (!hasNight) event.estimated_cost = '0.00';
    else if (nightlyCost > 0) event.estimated_cost = formatCost(nightlyCost);
  }
}

/** Etapa 3: um dia completo. Erro aqui derruba o pipeline (o gerador cai no prompt unico). */
export async function detailDay(ctx: PipelineContext, input: DayDetailInput): Promise<GeneratedDay> {
  const date = ctx.dates[input.day.day_number - 1];
  return runStage(ctx, `day_${input.day.day_number}`, {
    prompt: buildDayPrompt(ctx, input),
    schema: DAY_SCHEMA,
    maxOutputTokens: 3500,
    parse: (payload, attempt) => {
      const normalized = normalizeItineraryPayload(
        { title: 'dia', days: [payload] },
        { fallbackTitle: input.day.theme, currencyCode: ctx.currency, durationDays: 1, validPoiIds: input.validPoiIds, strict: true },
      );
      const day = normalized.days[0];
      if (!attempt.final && day.events.length < 2) throw new LlmResponseError('o dia veio com menos de 2 eventos');
      day.title = day.title === 'Dia 1' ? input.day.theme : day.title;
      day.details = normalizeDayDetails({ ...payload, date: date?.date, weekday: date?.weekday, theme: input.day.theme, area: payload.area || input.day.area });
      applyLodgingPolicy(day, input.hasNight, input.plan.lodging?.nightly_cost ?? 0);
      return day;
    },
  });
}
