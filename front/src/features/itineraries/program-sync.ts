import type { Itinerary, ItineraryDay } from "@/types/travel";
import { scheduleItineraryDays } from "./itinerary-schedule.ts";

/**
 * Edição da programação gravada no servidor (#50). Funções puras: o componente aplica cada ação na tela
 * na hora (com os horários recalculados pela mesma regra do servidor) e a envia numa fila sequencial de
 * PUT /program. Cada PUT leva o layout completo, então uma ação mais nova sempre substitui as anteriores.
 */

export interface ProgramLayout {
  days: { day_number: number; event_ids: number[] }[];
}

/** Layout que o PUT /api/itineraries/:id/program espera: a ordem dos ids de cada dia. */
export function programLayout(days: ItineraryDay[]): ProgramLayout {
  return { days: days.map(day => ({ day_number: day.day_number, event_ids: day.events.map(event => Number(event.id)) })) };
}

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Reordena dentro do dia (arrastar ou setas). Índices fora do dia não mudam nada. */
export function reorderEvent(days: ItineraryDay[], dayNumber: number, from: number, to: number): ItineraryDay[] {
  return days.map(day => {
    if (day.day_number !== dayNumber || from === to) return day;
    if (from < 0 || to < 0 || from >= day.events.length || to >= day.events.length) return day;
    return { ...day, events: move(day.events, from, to) };
  });
}

/** Leva a atividade para o fim do dia escolhido. */
export function moveEvent(days: ItineraryDay[], eventId: number | string, targetDay: number): ItineraryDay[] {
  const source = days.find(day => day.events.some(event => String(event.id) === String(eventId)));
  if (!source || source.day_number === targetDay || !days.some(day => day.day_number === targetDay)) return days;
  const event = source.events.find(item => String(item.id) === String(eventId))!;
  return days.map(day => {
    if (day === source) return { ...day, events: day.events.filter(item => item !== event) };
    if (day.day_number === targetDay) return { ...day, events: [...day.events, event] };
    return day;
  });
}

export function removeEvent(days: ItineraryDay[], eventId: number | string): ItineraryDay[] {
  return days.map(day => day.events.some(event => String(event.id) === String(eventId))
    ? { ...day, events: day.events.filter(event => String(event.id) !== String(eventId)) }
    : day);
}

const cents = (value: unknown) => value == null || value === "" ? NaN : Math.round(Number(value) * 100);

/**
 * Estado otimista: horários recalculados a partir do estado atual (mesma regra do servidor), custo do dia
 * e total. Lança erro em PT quando um dia passaria da meia-noite; nesse caso nada deve ser enviado.
 */
export function applyProgram(itinerary: Itinerary, days: ItineraryDay[]): Itinerary {
  const scheduled = scheduleItineraryDays(itinerary, days);
  const totals = scheduled.map(day => cents(day.estimated_cost));
  const budget = totals.every(Number.isFinite) ? (totals.reduce((sum, value) => sum + value, 0) / 100).toFixed(2) : itinerary.budget_total;
  return { ...itinerary, days: scheduled, budget_total: budget };
}

/** Quantas alterações o servidor consegue desfazer (metadata.program_history). */
export function programHistorySize(itinerary: Itinerary | null | undefined): number {
  const history = itinerary?.metadata?.program_history;
  return Array.isArray(history) ? history.length : 0;
}

/** Volta = ida + duração − 1 (datas YYYY-MM-DD em UTC, sem horário de verão no meio). */
export function tripEndDate(startDate: string | null | undefined, durationDays: unknown): string | null {
  const days = Number(durationDays);
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isInteger(days) || days < 1) return null;
  const date = new Date(`${startDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== startDate) return null;
  date.setUTCDate(date.getUTCDate() + days - 1);
  return date.toISOString().slice(0, 10);
}

const LEGACY_PROGRAM_KEY = /^viajero\.[^.]+\.itinerary\.[^.]+\.program$/;

/** A programação editada ficava no localStorage (viajero.<usuário>.itinerary.<id>.program); agora vive no servidor. */
export function clearLegacyPrograms(storage: Pick<Storage, "length" | "key" | "removeItem">): number {
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && LEGACY_PROGRAM_KEY.test(key)) keys.push(key);
    }
    keys.forEach(key => storage.removeItem(key));
    return keys.length;
  } catch {
    return 0;
  }
}

export type SaveOutcome<T> = { ok: true; value: T } | { ok: false; error: unknown; task: () => Promise<T> };

export interface SaveQueue<T> {
  /** Põe a ação no fim da fila; ela só começa quando a anterior terminar. */
  push(task: () => Promise<T>): Promise<void>;
  /** Resolve quando não houver mais nada na fila. */
  drain(): Promise<void>;
  /** Ações em andamento ou aguardando. */
  size(): number;
}

/**
 * Fila sequencial de salvamento. `latest` é true só para a ação mais nova: a resposta do servidor
 * deve substituir o estado da tela apenas nesse caso, para não desfazer ações que ainda vão ser enviadas.
 */
export function createSaveQueue<T>(handlers: {
  onStart?: () => void;
  onSettled: (outcome: SaveOutcome<T>, latest: boolean) => void;
}): SaveQueue<T> {
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;
  return {
    push(task) {
      pending += 1;
      handlers.onStart?.();
      const run = tail.then(async () => {
        let outcome: SaveOutcome<T>;
        try {
          outcome = { ok: true, value: await task() };
        } catch (error) {
          outcome = { ok: false, error, task };
        }
        pending -= 1;
        handlers.onSettled(outcome, pending === 0);
      });
      // Um erro no handler não pode travar as próximas ações.
      tail = run.catch(() => undefined);
      return run;
    },
    async drain() {
      while (pending > 0) await tail;
    },
    size() {
      return pending;
    },
  };
}
