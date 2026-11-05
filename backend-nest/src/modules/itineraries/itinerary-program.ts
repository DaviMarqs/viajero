import { BadRequestException, ConflictException } from '@nestjs/common';

/**
 * Regras puras da edicao da programacao do roteiro (#50).
 * - Layout: o front manda a ordem completa dos eventos por dia; o servidor valida, recalcula horarios e custos.
 * - Memento: antes de cada alteracao, um snapshot vai para `metadata.program_history` (no maximo 10);
 *   o desfazer reconcilia o estado atual com o ultimo snapshot.
 * Nada aqui acessa o banco: o ItineraryProgramService aplica o resultado numa transacao.
 */

export const PROGRAM_HISTORY_KEY = 'program_history';
export const PROGRAM_HISTORY_LIMIT = 10;
const DAY_START_MINUTES = 9 * 60;
const DEFAULT_ACTIVITY_MINUTES = 90;
const TRANSFER_MINUTES = 30;
const MINUTES_PER_DAY = 24 * 60;
const MS_PER_DAY = 86_400_000;

/** Evento como vem do banco (ids bigint chegam como string do TypeORM). */
export interface ProgramEventSource {
  id: number | string;
  title: string;
  description: string;
  estimated_cost: string | number;
  order_index: number;
  start_time: string | null;
  end_time: string | null;
  poi?: { id: number | string; estimated_visit_minutes?: number | null } | null;
}

export interface ProgramDaySource {
  id: number | string;
  day_number: number;
  title: string;
  summary: string;
  estimated_cost: string | number;
  events: ProgramEventSource[];
}

export interface ProgramItineraryFields {
  title: string;
  start_date: string | null;
  end_date: string | null;
  budget_total: string | number;
}

export interface ProgramLayoutDay {
  day_number: number;
  event_ids: Array<number | string>;
}

export interface ProgramLayout {
  days: ProgramLayoutDay[];
}

export interface ScheduledEventChange {
  id: number;
  day_id: number;
  order_index: number;
  start_time: string;
  end_time: string;
}

export interface DayCostChange {
  id: number;
  estimated_cost: string;
}

export interface ProgramChange {
  events: ScheduledEventChange[];
  removed_event_ids: number[];
  days: DayCostChange[];
  budget_total: string;
}

export interface ProgramSnapshotEvent {
  id: number;
  title: string;
  description: string;
  estimated_cost: string;
  order_index: number;
  start_time: string | null;
  end_time: string | null;
  poi_id: number | null;
}

export interface ProgramSnapshotDay {
  day_number: number;
  title: string;
  summary: string;
  estimated_cost: string;
  events: ProgramSnapshotEvent[];
}

export interface ProgramSnapshot {
  title: string;
  start_date: string | null;
  end_date: string | null;
  budget_total: string;
  days: ProgramSnapshotDay[];
}

export interface RestoredEventFields {
  title: string;
  description: string;
  estimated_cost: string;
  order_index: number;
  start_time: string | null;
  end_time: string | null;
  poi_id: number | null;
}

export interface ProgramRestorePlan {
  updates: Array<{ id: number; day_id: number; fields: RestoredEventFields }>;
  creates: Array<{ day_id: number; fields: RestoredEventFields }>;
  deletes: number[];
  days: Array<{ id: number; title: string; summary: string; estimated_cost: string }>;
  itinerary: { title: string; start_date: string | null; end_date: string | null; budget_total: string };
}

const toId = (value: number | string): number => Number(value);
const toCents = (value: string | number | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};
const fromCents = (cents: number): string => (cents / 100).toFixed(2);

function clockMinutes(value: string | null | undefined): number | null {
  if (!value || !/^\d{2}:\d{2}/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : null;
}

const clock = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Mesma regra do front (itinerary-schedule.ts): fim - inicio, senao duracao do POI, senao 90 min. */
export function activityMinutes(event: Pick<ProgramEventSource, 'start_time' | 'end_time' | 'poi'>): number {
  const start = clockMinutes(event.start_time);
  const end = clockMinutes(event.end_time);
  if (start !== null && end !== null && end > start) return end - start;
  const estimated = Number(event.poi?.estimated_visit_minutes);
  return Number.isFinite(estimated) && estimated > 0 ? Math.round(estimated) : DEFAULT_ACTIVITY_MINUTES;
}

/** O dia comeca no menor horario original dele, ou as 09:00. */
export function dayStartMinutes(events: Array<Pick<ProgramEventSource, 'start_time'>>): number {
  const starts = events.map((event) => clockMinutes(event.start_time)).filter((value): value is number => value !== null);
  return starts.length > 0 ? Math.min(...starts) : DAY_START_MINUTES;
}

/** Horarios em sequencia com 30 min de deslocamento; passar da meia-noite e erro 400. */
export function scheduleDay(
  dayNumber: number,
  startMinutes: number,
  events: Array<Pick<ProgramEventSource, 'start_time' | 'end_time' | 'poi'>>,
): Array<{ start_time: string; end_time: string }> {
  let cursor = startMinutes;
  return events.map((event) => {
    const end = cursor + activityMinutes(event);
    if (end >= MINUTES_PER_DAY) {
      throw new BadRequestException(`As atividades do dia ${dayNumber} passam da meia-noite. Remova ou mova uma atividade.`);
    }
    const slot = { start_time: clock(cursor), end_time: clock(end) };
    cursor = end + TRANSFER_MINUTES;
    return slot;
  });
}

function parseLayoutId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value);
  return null;
}

/** Valida o layout contra os dias atuais. Erros viram 400 com mensagem em PT. */
export function validateProgramLayout(days: ProgramDaySource[], layout: ProgramLayout): void {
  if (!layout || !Array.isArray(layout.days)) throw new BadRequestException('Envie a programacao com a lista de dias.');
  const currentDays = new Set(days.map((day) => day.day_number));
  const layoutDays = new Set<number>();
  for (const day of layout.days) {
    if (layoutDays.has(day.day_number)) throw new BadRequestException(`O dia ${day.day_number} aparece mais de uma vez na programacao.`);
    if (!currentDays.has(day.day_number)) throw new BadRequestException(`O dia ${day.day_number} nao existe neste roteiro.`);
    layoutDays.add(day.day_number);
  }
  const missing = [...currentDays].filter((dayNumber) => !layoutDays.has(dayNumber));
  if (missing.length > 0) throw new BadRequestException(`A programacao precisa incluir todos os dias do roteiro. Falta o dia ${missing[0]}.`);

  const eventIds = new Set(days.flatMap((day) => day.events.map((event) => toId(event.id))));
  const seen = new Set<number>();
  for (const day of layout.days) {
    if (!Array.isArray(day.event_ids)) throw new BadRequestException(`Informe as atividades do dia ${day.day_number}.`);
    for (const raw of day.event_ids) {
      const id = parseLayoutId(raw);
      if (id === null || !eventIds.has(id)) throw new BadRequestException(`A atividade ${String(raw)} nao pertence a este roteiro.`);
      if (seen.has(id)) throw new BadRequestException(`A atividade ${id} aparece mais de uma vez na programacao.`);
      seen.add(id);
    }
  }
}

/**
 * Aplica o layout: ordem e dia de cada evento, horarios recalculados, custo do dia = soma dos eventos
 * e total = soma dos dias. Eventos atuais fora do layout sao removidos.
 */
export function applyProgramLayout(days: ProgramDaySource[], layout: ProgramLayout): ProgramChange {
  validateProgramLayout(days, layout);
  const eventsById = new Map(days.flatMap((day) => day.events.map((event) => [toId(event.id), event] as const)));
  const layoutByDay = new Map(layout.days.map((day) => [day.day_number, day.event_ids.map((raw) => parseLayoutId(raw) as number)]));

  const events: ScheduledEventChange[] = [];
  const dayCosts: DayCostChange[] = [];
  let budgetCents = 0;
  for (const day of [...days].sort((a, b) => a.day_number - b.day_number)) {
    const ordered = (layoutByDay.get(day.day_number) ?? []).map((id) => eventsById.get(id) as ProgramEventSource);
    const slots = scheduleDay(day.day_number, dayStartMinutes(day.events), ordered);
    ordered.forEach((event, index) => {
      events.push({ id: toId(event.id), day_id: toId(day.id), order_index: index, ...slots[index] });
    });
    const dayCents = ordered.reduce((sum, event) => sum + toCents(event.estimated_cost), 0);
    budgetCents += dayCents;
    dayCosts.push({ id: toId(day.id), estimated_cost: fromCents(dayCents) });
  }
  const kept = new Set(events.map((event) => event.id));
  return {
    events,
    removed_event_ids: [...eventsById.keys()].filter((id) => !kept.has(id)),
    days: dayCosts,
    budget_total: fromCents(budgetCents),
  };
}

export function buildProgramSnapshot(itinerary: ProgramItineraryFields, days: ProgramDaySource[]): ProgramSnapshot {
  return {
    title: itinerary.title,
    start_date: itinerary.start_date ?? null,
    end_date: itinerary.end_date ?? null,
    budget_total: fromCents(toCents(itinerary.budget_total)),
    days: [...days]
      .sort((a, b) => a.day_number - b.day_number)
      .map((day) => ({
        day_number: day.day_number,
        title: day.title,
        summary: day.summary ?? '',
        estimated_cost: fromCents(toCents(day.estimated_cost)),
        events: [...day.events]
          .sort((a, b) => a.order_index - b.order_index)
          .map((event) => ({
            id: toId(event.id),
            title: event.title,
            description: event.description ?? '',
            estimated_cost: fromCents(toCents(event.estimated_cost)),
            order_index: event.order_index,
            start_time: event.start_time ?? null,
            end_time: event.end_time ?? null,
            poi_id: event.poi ? toId(event.poi.id) : null,
          })),
      })),
  };
}

function isSnapshot(value: unknown): value is ProgramSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<ProgramSnapshot>;
  return typeof snapshot.title === 'string' && Array.isArray(snapshot.days) && snapshot.days.every((day) => day && Array.isArray(day.events));
}

export function readProgramHistory(metadata: Record<string, unknown> | null | undefined): ProgramSnapshot[] {
  const history = metadata?.[PROGRAM_HISTORY_KEY];
  return Array.isArray(history) ? history.filter(isSnapshot) : [];
}

/** Guarda o snapshot no fim do historico (mais novo por ultimo), descartando os mais antigos alem do limite. */
export function pushProgramSnapshot(
  metadata: Record<string, unknown> | null | undefined,
  snapshot: ProgramSnapshot,
  limit = PROGRAM_HISTORY_LIMIT,
): Record<string, unknown> {
  const history = [...readProgramHistory(metadata), snapshot].slice(-limit);
  return { ...(metadata ?? {}), [PROGRAM_HISTORY_KEY]: history };
}

/** Tira o ultimo snapshot do historico; null quando nao ha o que desfazer. */
export function popProgramSnapshot(
  metadata: Record<string, unknown> | null | undefined,
): { snapshot: ProgramSnapshot; metadata: Record<string, unknown> } | null {
  const history = readProgramHistory(metadata);
  const snapshot = history.pop();
  if (!snapshot) return null;
  return { snapshot, metadata: { ...(metadata ?? {}), [PROGRAM_HISTORY_KEY]: history } };
}

/**
 * PATCH que muda nome ou datas de um roteiro pronto tambem entra no historico do desfazer.
 * Devolve o metadata com o snapshot do estado anterior, ou null quando nao ha o que guardar.
 */
export function metadataWithDetailsSnapshot(
  itinerary: ProgramItineraryFields & { generation_status: string; metadata: Record<string, unknown> | null; days?: ProgramDaySource[] | null },
  next: { title: string; start_date: string | null; end_date: string | null },
  metadata: Record<string, unknown> | null | undefined = itinerary.metadata,
): Record<string, unknown> | null {
  const changed = next.title !== itinerary.title || next.start_date !== (itinerary.start_date ?? null) || next.end_date !== (itinerary.end_date ?? null);
  if (itinerary.generation_status !== 'ready' || !changed) return null;
  return pushProgramSnapshot(metadata, buildProgramSnapshot(itinerary, itinerary.days ?? []));
}

/** Uma geracao completa troca todos os eventos: o historico antigo deixa de fazer sentido. */
export function withoutProgramHistory(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const rest = { ...(metadata ?? {}) };
  delete rest[PROGRAM_HISTORY_KEY];
  return rest;
}

/**
 * Reconcilia o estado atual com o snapshot: eventos que ainda existem sao atualizados, os removidos depois
 * do snapshot sao recriados (id novo) e os que nao estao no snapshot sao apagados.
 */
export function planProgramRestore(days: ProgramDaySource[], snapshot: ProgramSnapshot): ProgramRestorePlan {
  const dayIds = new Map(days.map((day) => [day.day_number, toId(day.id)]));
  const sameDays = snapshot.days.length === dayIds.size && snapshot.days.every((day) => dayIds.has(day.day_number));
  if (!sameDays) throw new ConflictException('Nao foi possivel desfazer: os dias do roteiro mudaram desde a alteracao.');

  const currentIds = new Set(days.flatMap((day) => day.events.map((event) => toId(event.id))));
  const restoredIds = new Set<number>();
  const plan: ProgramRestorePlan = {
    updates: [],
    creates: [],
    deletes: [],
    days: [],
    itinerary: {
      title: snapshot.title,
      start_date: snapshot.start_date ?? null,
      end_date: snapshot.end_date ?? null,
      budget_total: fromCents(toCents(snapshot.budget_total)),
    },
  };
  for (const day of snapshot.days) {
    const dayId = dayIds.get(day.day_number) as number;
    plan.days.push({ id: dayId, title: day.title, summary: day.summary ?? '', estimated_cost: fromCents(toCents(day.estimated_cost)) });
    for (const event of day.events) {
      const fields: RestoredEventFields = {
        title: event.title,
        description: event.description ?? '',
        estimated_cost: fromCents(toCents(event.estimated_cost)),
        order_index: event.order_index,
        start_time: event.start_time ?? null,
        end_time: event.end_time ?? null,
        poi_id: event.poi_id ?? null,
      };
      const id = toId(event.id);
      if (currentIds.has(id) && !restoredIds.has(id)) {
        restoredIds.add(id);
        plan.updates.push({ id, day_id: dayId, fields });
      } else {
        plan.creates.push({ day_id: dayId, fields });
      }
    }
  }
  plan.deletes = [...currentIds].filter((id) => !restoredIds.has(id));
  return plan;
}

/** Quantos dias o intervalo cobre, contando ida e volta (datas YYYY-MM-DD). */
export function tripDayCount(startDate: string, endDate: string): number {
  return Math.round((Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`)) / MS_PER_DAY) + 1;
}

/** No PATCH, ida e volta precisam cobrir exatamente a duracao do roteiro. */
export function assertDatesMatchDuration(startDate: string | null, endDate: string | null, durationDays: number): void {
  if (!startDate || !endDate) return;
  if (tripDayCount(startDate, endDate) !== durationDays) {
    throw new BadRequestException(`As datas precisam cobrir exatamente ${durationDays} ${durationDays === 1 ? 'dia' : 'dias'}.`);
  }
}
