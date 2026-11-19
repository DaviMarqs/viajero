import type { PointOfInterest } from '../../../destinations/entities';
import type { JsonObject } from '../../llm/llm-provider';
import { LlmResponseError } from '../../llm/llm.errors';
import { parseCost } from '../itinerary-costs';
import { asObjects, text, textList } from '../itinerary-details';
import { normalizePoiId } from '../itinerary-normalizer';
import { poiForPrompt } from '../itinerary-prompt';
import { PipelineContext, runStage, sectionedPrompt } from './shared';

export interface PoiInsight {
  area?: string;
  best_time_of_day?: string;
  closed_days: string[];
  booking_required: boolean;
  ticket_cost: number;
}

export const POI_ANALYSIS_SCHEMA: JsonObject = {
  type: 'object',
  properties: {
    pois: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          poi_id: { type: 'integer' },
          area: { type: 'string' },
          best_time_of_day: { type: 'string', enum: ['manha', 'tarde', 'noite', 'qualquer'] },
          closed_days: { type: 'array', items: { type: 'string' } },
          booking_required: { type: 'boolean' },
          ticket_cost: { type: 'string' },
        },
        required: ['poi_id'],
      },
    },
  },
  required: ['pois'],
};

const WEEKDAY_ALIASES: Record<string, string> = {
  domingo: 'domingo', sunday: 'domingo', dom: 'domingo',
  segunda: 'segunda-feira', 'segunda-feira': 'segunda-feira', monday: 'segunda-feira', seg: 'segunda-feira',
  terca: 'terca-feira', 'terca-feira': 'terca-feira', 'terça': 'terca-feira', 'terça-feira': 'terca-feira', tuesday: 'terca-feira', ter: 'terca-feira',
  quarta: 'quarta-feira', 'quarta-feira': 'quarta-feira', wednesday: 'quarta-feira', qua: 'quarta-feira',
  quinta: 'quinta-feira', 'quinta-feira': 'quinta-feira', thursday: 'quinta-feira', qui: 'quinta-feira',
  sexta: 'sexta-feira', 'sexta-feira': 'sexta-feira', friday: 'sexta-feira', sex: 'sexta-feira',
  sabado: 'sabado', 'sábado': 'sabado', saturday: 'sabado', sab: 'sabado',
};

export const normalizeWeekday = (value: string): string | undefined => WEEKDAY_ALIASES[value.trim().toLowerCase()];

export function normalizePoiInsights(payload: JsonObject, validPoiIds: Set<number>): Map<number, PoiInsight> {
  const insights = new Map<number, PoiInsight>();
  for (const item of asObjects(payload.pois)) {
    const id = normalizePoiId(item.poi_id, validPoiIds);
    if (id === undefined || insights.has(id)) continue;
    insights.set(id, {
      area: text(item.area, 120) || undefined,
      best_time_of_day: text(item.best_time_of_day, 20) || undefined,
      closed_days: textList(item.closed_days, 7, 20).map(normalizeWeekday).filter((day): day is string => !!day),
      booking_required: item.booking_required === true,
      ticket_cost: parseCost(item.ticket_cost),
    });
  }
  return insights;
}

/** Etapa 1b: bairro, melhor horario, dias fechados, reserva e ingresso de cada POI. */
export async function analyzePois(ctx: PipelineContext, pois: PointOfInterest[]): Promise<Map<number, PoiInsight>> {
  if (pois.length === 0) return new Map();
  const validPoiIds = new Set(pois.map((poi) => Number(poi.id)));
  const prompt = sectionedPrompt({
    role: 'Voce e um especialista local que conhece as atracoes do destino.',
    task: `Analise os pontos de interesse de ${ctx.context.destination.name} (${ctx.context.destination.country}) para ajudar a montar o roteiro.`,
    data: { moeda: ctx.currency, pois: pois.map((poi) => ({ ...poiForPrompt(poi, 240), metadata: poi.metadata ?? {} })) },
    rules: [
      'Responda um item por POI, usando exatamente o poi_id recebido.',
      'area: bairro ou regiao da cidade onde o POI fica (use o address quando houver). POIs vizinhos devem ter a mesma area.',
      'best_time_of_day: manha, tarde, noite ou qualquer (luz, calor, fila, movimento).',
      'closed_days: dias da semana em que FECHA (ex.: "segunda-feira"), a partir de opening_hours ou do que voce sabe; vazio se abre todo dia ou nao souber.',
      'booking_required: true so quando costuma esgotar ou exige horario marcado.',
      `ticket_cost: preco de um ingresso adulto em ${ctx.currency}, formato '12.34'; '0.00' quando e gratis.`,
    ],
    output: 'Objeto JSON { "pois": [...] }.',
  });
  return runStage(ctx, 'poi_analysis', {
    prompt,
    schema: POI_ANALYSIS_SCHEMA,
    maxOutputTokens: Math.min(6000, 600 + pois.length * 90),
    parse: (payload) => {
      const insights = normalizePoiInsights(payload, validPoiIds);
      if (insights.size === 0) throw new LlmResponseError('a analise dos POIs veio vazia');
      return insights;
    },
  });
}
