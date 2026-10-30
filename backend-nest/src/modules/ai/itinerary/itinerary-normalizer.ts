import type { GeneratedItinerary } from '../itinerary-generators';
import type { JsonObject } from '../llm/llm-provider';
import { LlmResponseError } from '../llm/llm.errors';
import { formatCost, parseCost } from './itinerary-costs';

type RawObject = Record<string, unknown>;

const asObjects = (value: unknown): RawObject[] =>
  Array.isArray(value) ? value.filter((item): item is RawObject => !!item && typeof item === 'object' && !Array.isArray(item)) : [];
const text = (value: unknown, max: number) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '').slice(0, max);

/** "9:00", "09:00" e "09:00:00" viram "09:00"; o resto vira undefined. */
export function normalizeClock(value: unknown): string | undefined {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(typeof value === 'string' ? value.trim() : '');
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

/** O LLM nem sempre lista os eventos em ordem; quando todos tem horario, o horario manda. */
function chronological<T extends { start_time?: string }>(events: T[]): T[] {
  if (!events.every((event) => event.start_time)) return events;
  return [...events].sort((a, b) => (a.start_time as string).localeCompare(b.start_time as string));
}

function normalizePoiId(value: unknown, validPoiIds: Set<number>): number | undefined {
  const id = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isInteger(id) && validPoiIds.has(id) ? id : undefined;
}

/**
 * Normaliza a resposta do LLM para o formato persistido: descarta poi_id que nao pertence ao destino,
 * limita tamanhos as colunas, converte custos/horarios e corta dias alem da duracao pedida.
 * Lanca LlmResponseError (nova tentativa) sem nenhum dia valido e, no modo `strict`, quando faltam dias
 * ou algum dia veio sem eventos.
 */
export function normalizeItineraryPayload(
  payload: JsonObject,
  input: {
    fallbackTitle: string;
    currencyCode: string;
    durationDays: number;
    validPoiIds: Set<number>;
    strict?: boolean;
  },
): GeneratedItinerary {
  const days: GeneratedItinerary['days'] = asObjects(payload.days)
    .slice(0, input.durationDays)
    .map((day, dayIndex) => ({
      title: text(day.title, 120) || `Dia ${dayIndex + 1}`,
      summary: text(day.summary, 4000),
      events: chronological(
        asObjects(day.events)
          .map((event) => {
            const startTime = normalizeClock(event.start_time);
            const endTime = normalizeClock(event.end_time);
            return {
              poi_id: normalizePoiId(event.poi_id, input.validPoiIds),
              title: text(event.title, 160),
              description: text(event.description, 4000),
              estimated_cost: formatCost(parseCost(event.estimated_cost)),
              start_time: startTime,
              end_time: startTime && endTime && endTime > startTime ? endTime : undefined,
            };
          })
          .filter((event) => event.title),
      ).map((event, order_index) => ({ ...event, order_index })),
    }));

  if (days.length === 0) throw new LlmResponseError('o roteiro veio sem dias');
  if (input.strict) {
    if (days.length < input.durationDays) {
      throw new LlmResponseError(`o roteiro veio com ${days.length} dia(s), mas eram esperados exatamente ${input.durationDays}`);
    }
    const emptyDay = days.findIndex((day) => day.events.length === 0);
    if (emptyDay >= 0) throw new LlmResponseError(`o dia ${emptyDay + 1} veio sem eventos`);
  }

  return {
    title: text(payload.title, 160) || input.fallbackTitle,
    summary: text(payload.summary, 4000),
    estimated_cost: formatCost(parseCost(payload.estimated_cost)),
    currency_code: text(payload.currency_code, 3).toUpperCase() || input.currencyCode,
    days,
    metadata: {},
  };
}
