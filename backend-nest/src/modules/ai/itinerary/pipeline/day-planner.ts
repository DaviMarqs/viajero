import type { PointOfInterest } from '../../../destinations/entities';
import type { JsonObject } from '../../llm/llm-provider';
import { LlmResponseError } from '../../llm/llm.errors';
import { parseCost } from '../itinerary-costs';
import { TripGuide, asObjects, isObject, text } from '../itinerary-details';
import { normalizePoiId } from '../itinerary-normalizer';
import type { PoiInsight } from './poi-analysis';
import { PipelineContext, runStage, sectionedPrompt } from './shared';

export interface PlannedDay {
  day_number: number;
  theme: string;
  area?: string;
  poi_ids: number[];
}

export interface Lodging {
  area?: string;
  suggestion?: string;
  nightly_cost: number;
}

export interface TripPlan {
  title: string;
  summary: string;
  lodging?: Lodging;
  days: PlannedDay[];
}

export const PLAN_SCHEMA: JsonObject = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    lodging: { type: 'object', properties: { area: { type: 'string' }, suggestion: { type: 'string' }, nightly_cost: { type: 'string' } } },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day_number: { type: 'integer' },
          theme: { type: 'string' },
          area: { type: 'string' },
          poi_ids: { type: 'array', items: { type: 'integer' } },
        },
        required: ['day_number', 'theme', 'poi_ids'],
      },
    },
  },
  required: ['title', 'days'],
};

/** Quantas atracoes por dia cabem no ritmo do viajante. */
export function poisPerDay(pace: unknown): number {
  const value = String(pace ?? '').toLowerCase();
  if (['slow', 'lento', 'relaxed', 'tranquilo'].includes(value)) return 2;
  if (['fast', 'rapido', 'intense', 'intenso'].includes(value)) return 4;
  return 3;
}

/** Valida o esqueleto: ids do destino, nenhum POI repetido entre dias e exatamente `durationDays` dias. */
export function normalizePlan(payload: JsonObject, durationDays: number, validPoiIds: Set<number>, fallbackTitle: string): TripPlan {
  const used = new Set<number>();
  const byNumber = new Map<number, PlannedDay>();
  asObjects(payload.days).forEach((day, index) => {
    const dayNumber = Number.isInteger(day.day_number) ? Number(day.day_number) : index + 1;
    if (dayNumber < 1 || dayNumber > durationDays || byNumber.has(dayNumber)) return;
    const poiIds: number[] = [];
    for (const raw of Array.isArray(day.poi_ids) ? day.poi_ids : []) {
      const id = normalizePoiId(raw, validPoiIds);
      if (id === undefined || used.has(id)) continue;
      used.add(id);
      poiIds.push(id);
    }
    byNumber.set(dayNumber, { day_number: dayNumber, theme: text(day.theme, 120) || `Dia ${dayNumber}`, area: text(day.area, 160) || undefined, poi_ids: poiIds });
  });
  if (byNumber.size !== durationDays) {
    throw new LlmResponseError(`o plano veio com ${byNumber.size} dia(s), mas eram esperados exatamente ${durationDays}`);
  }
  const lodging = isObject(payload.lodging)
    ? { area: text(payload.lodging.area, 160) || undefined, suggestion: text(payload.lodging.suggestion, 200) || undefined, nightly_cost: parseCost(payload.lodging.nightly_cost) }
    : undefined;
  return {
    title: text(payload.title, 160) || fallbackTitle,
    summary: text(payload.summary, 4000),
    lodging,
    days: [...byNumber.values()].sort((a, b) => a.day_number - b.day_number),
  };
}

/**
 * Plano sem LLM: POIs por nota, agrupados por area (quando a analise trouxe), em blocos do tamanho do ritmo.
 * Evita colocar um POI num dia em que ele fecha, quando ha outro dia possivel.
 */
export function fallbackPlan(
  ctx: Pick<PipelineContext, 'context' | 'dates'>,
  pois: PointOfInterest[],
  insights: Map<number, PoiInsight>,
  fallbackTitle: string,
  nightlyCost = 0,
): TripPlan {
  const perDay = poisPerDay(ctx.context.profile?.pace);
  const duration = ctx.context.duration_days;
  const areaOf = (poi: PointOfInterest) => insights.get(Number(poi.id))?.area ?? '';
  // Ordem por area (a area do melhor POI primeiro), mantendo a nota dentro da area.
  const areaRank = new Map<string, number>();
  pois.forEach((poi, index) => {
    if (!areaRank.has(areaOf(poi))) areaRank.set(areaOf(poi), index);
  });
  const ordered = [...pois].slice(0, perDay * duration).sort((a, b) => (areaRank.get(areaOf(a)) ?? 0) - (areaRank.get(areaOf(b)) ?? 0));
  const days: PlannedDay[] = ctx.dates.map((date) => ({ day_number: date.day_number, theme: `Dia ${date.day_number}`, poi_ids: [] }));
  const closedOn = (poi: PointOfInterest, dayIndex: number) => {
    const weekday = ctx.dates[dayIndex]?.weekday;
    return !!weekday && (insights.get(Number(poi.id))?.closed_days ?? []).includes(weekday);
  };
  const hasRoom = (index: number) => days[index].poi_ids.length < perDay;
  // Dia em que a area de cada POI ja esta: o proximo POI da mesma area vai para ele, se couber.
  const dayOfArea = new Map<string, number>();
  let cursor = 0;
  for (const poi of ordered) {
    while (cursor < days.length && !hasRoom(cursor)) cursor += 1;
    if (cursor >= days.length) break;
    const area = areaOf(poi);
    const sameArea = area ? dayOfArea.get(area) : undefined;
    let target = sameArea !== undefined && hasRoom(sameArea) && !closedOn(poi, sameArea) ? sameArea : cursor;
    if (closedOn(poi, target)) {
      const open = days.findIndex((_, index) => index >= cursor && hasRoom(index) && !closedOn(poi, index));
      if (open >= 0) target = open;
    }
    days[target].poi_ids.push(Number(poi.id));
    if (area) dayOfArea.set(area, target);
  }
  for (const day of days) {
    const areas = [...new Set(day.poi_ids.map((id) => insights.get(id)?.area).filter((area): area is string => !!area))];
    if (areas.length > 0) {
      day.area = areas.join(', ').slice(0, 160);
      day.theme = areas[0].slice(0, 120);
    }
  }
  return {
    title: fallbackTitle,
    summary: '',
    lodging: nightlyCost > 0 ? { nightly_cost: nightlyCost } : undefined,
    days,
  };
}

/** Etapa 2: esqueleto da viagem (tema, area e POIs de cada dia, hospedagem unica). */
export async function planTrip(
  ctx: PipelineContext,
  pois: PointOfInterest[],
  insights: Map<number, PoiInsight>,
  guide: TripGuide | undefined,
  fallbackTitle: string,
): Promise<TripPlan> {
  const validPoiIds = new Set(pois.map((poi) => Number(poi.id)));
  const perDay = poisPerDay(ctx.context.profile?.pace);
  const prefs = ctx.context.preferences;
  const prompt = sectionedPrompt({
    role: 'Voce e um planejador de viagens que organiza a logistica antes dos detalhes.',
    task: `Distribua as atracoes de ${ctx.context.destination.name} em EXATAMENTE ${ctx.context.duration_days} dia(s) e escolha UMA hospedagem para a viagem toda.`,
    data: {
      dias: ctx.dates,
      ritmo: ctx.context.profile?.pace ?? 'moderado',
      atracoes_por_dia: perDay,
      interesses: prefs?.interests ?? [],
      viajantes: prefs?.companionship ?? null,
      hospedagem_nivel: prefs?.hotel_level ?? null,
      acessibilidade: prefs?.accessibility_needs ?? [],
      moeda: ctx.currency,
      bairros: guide?.neighborhoods ?? [],
      clima: guide?.weather ?? null,
      diaria_referencia: guide?.cost_benchmarks?.hotel_night ?? null,
      pois: pois.map((poi) => ({
        id: Number(poi.id),
        name: poi.name,
        type: poi.poi_type,
        rating: String(poi.rating ?? '0'),
        visit_minutes: poi.estimated_visit_minutes || 90,
        ...(insights.get(Number(poi.id)) ?? {}),
      })),
    },
    rules: [
      `Gere exatamente ${ctx.context.duration_days} dias, day_number de 1 a ${ctx.context.duration_days}.`,
      `Cada dia recebe ate ${perDay} poi_ids (so ids da lista), sem repetir POI entre dias. Priorize os interesses e as melhores notas.`,
      'Agrupe POIs da MESMA area no mesmo dia para reduzir deslocamento; informe a area principal do dia.',
      'Nunca coloque um POI num dia da semana em que ele esta em closed_days.',
      'Se o clima indicar chuva, deixe atracoes ao ar livre em dias diferentes, para haver flexibilidade.',
      'theme: tema curto do dia, sem "Dia N". title: nome curto e atraente para a viagem. summary: 2 frases sobre a viagem.',
      `lodging: bairro bem localizado para os dias planejados, sugestao de tipo/hotel e nightly_cost (diaria) em ${ctx.currency}, formato '123.45', coerente com o nivel pedido e a referencia.`,
      'Escreva em portugues do Brasil.',
    ],
    output: 'Objeto JSON com title, summary, lodging e days.',
  });
  return runStage(ctx, 'planner', {
    prompt,
    schema: PLAN_SCHEMA,
    maxOutputTokens: Math.min(6000, 800 + ctx.context.duration_days * 200),
    parse: (payload) => normalizePlan(payload, ctx.context.duration_days, validPoiIds, fallbackTitle),
  });
}
