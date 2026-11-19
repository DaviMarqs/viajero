import type { GeneratedItinerary } from '../../itinerary-generators';
import { parseCost } from '../itinerary-costs';
import type { PoiInsight } from './poi-analysis';

type Day = GeneratedItinerary['days'][number];

const LAST_MINUTE = 23 * 60 + 59;
const SLOW_DAY_MAX_MINUTES = 9 * 60;

const toMinutes = (clock?: string): number | null => {
  if (!clock || !/^\d{2}:\d{2}$/.test(clock)) return null;
  const [hours, minutes] = clock.split(':').map(Number);
  return hours * 60 + minutes;
};
const toClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Evento que comeca antes do fim do anterior e empurrado para o fim dele, mantendo a duracao
 * (limitado a 23:59). Devolve quantos eventos foram movidos.
 */
export function fixOverlaps(day: Day): number {
  let moved = 0;
  let previousEnd: number | null = null;
  for (const event of day.events) {
    const start = toMinutes(event.start_time);
    const end = toMinutes(event.end_time);
    if (start === null) continue;
    if (previousEnd !== null && start < previousEnd) {
      const duration = end !== null && end > start ? end - start : 60;
      const newStart = Math.min(previousEnd, LAST_MINUTE - 1);
      event.start_time = toClock(newStart);
      event.end_time = toClock(Math.min(newStart + duration, LAST_MINUTE));
      moved += 1;
    }
    previousEnd = toMinutes(event.end_time) ?? toMinutes(event.start_time);
  }
  return moved;
}

export interface QualityReport {
  warnings: string[];
  fixed_overlaps: number;
}

/** Corrige horarios e lista o que ficou fora das regras (gravado em generation_context.quality). */
export function reviewItinerary(
  result: GeneratedItinerary,
  options: { pace?: unknown; insights?: Map<number, PoiInsight> } = {},
): QualityReport {
  const warnings: string[] = [];
  let fixedOverlaps = 0;
  const seenPois = new Map<number, number>();
  const slow = ['slow', 'lento', 'relaxed', 'tranquilo'].includes(String(options.pace ?? '').toLowerCase());
  const lastDay = result.days.length;

  result.days.forEach((day, index) => {
    const dayNumber = index + 1;
    fixedOverlaps += fixOverlaps(day);
    const kinds = day.events.map((event) => event.details?.kind);
    if (!kinds.includes('meal')) warnings.push(`Dia ${dayNumber}: nenhuma refeicao planejada.`);
    if ((lastDay === 1 || dayNumber < lastDay) && !kinds.includes('lodging')) warnings.push(`Dia ${dayNumber}: sem hospedagem.`);

    for (const event of day.events) {
      if (event.poi_id === undefined) continue;
      const firstDay = seenPois.get(event.poi_id);
      if (firstDay !== undefined) warnings.push(`Dia ${dayNumber}: "${event.title}" repete um lugar do dia ${firstDay}.`);
      else seenPois.set(event.poi_id, dayNumber);
      const ticket = options.insights?.get(event.poi_id)?.ticket_cost ?? 0;
      if (ticket > 0 && parseCost(event.estimated_cost) === 0) warnings.push(`Dia ${dayNumber}: "${event.title}" e pago, mas esta com custo 0.`);
    }

    if (slow) {
      const starts = day.events.map((event) => toMinutes(event.start_time)).filter((value): value is number => value !== null);
      const ends = day.events
        .filter((event) => event.details?.kind !== 'lodging')
        .map((event) => toMinutes(event.end_time))
        .filter((value): value is number => value !== null);
      if (starts.length > 0 && ends.length > 0 && Math.max(...ends) - Math.min(...starts) > SLOW_DAY_MAX_MINUTES) {
        warnings.push(`Dia ${dayNumber}: dia longo para um ritmo tranquilo.`);
      }
    }
  });

  return { warnings, fixed_overlaps: fixedOverlaps };
}
