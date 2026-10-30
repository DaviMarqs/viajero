import type { Itinerary, ItineraryDay, ItineraryEvent } from "@/types/travel";

const TRANSFER_MINUTES = 30;
function minutes(value?: string | null): number | null {
  if (!value || !/^\d{2}:\d{2}/.test(value)) return null;
  const [hours, minute] = value.split(":").map(Number);
  return hours >= 0 && hours < 24 && minute >= 0 && minute < 60 ? hours * 60 + minute : null;
}
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
function duration(event: ItineraryEvent): number {
  const start = minutes(event.start_time), end = minutes(event.end_time);
  if (start != null && end != null && end > start) return end - start;
  const estimated = Number(event.poi?.estimated_visit_minutes);
  return Number.isFinite(estimated) && estimated > 0 ? Math.round(estimated) : 90;
}

/** A edição muda ordem/seleção; dados da atividade continuam vindo do backend. */
export function scheduleItineraryDays(original: Itinerary, days: ItineraryDay[]): ItineraryDay[] {
  const sourceDays = new Map((original.days ?? []).map(day => [String(day.id), day]));
  return days.map(day => {
    const source = sourceDays.get(String(day.id));
    if (!source) throw new Error("Este dia mudou no backend. Recarregue o roteiro antes de editar.");
    const events = new Map(source.events.map(event => [String(event.id), event]));
    const starts = source.events.map(event => minutes(event.start_time)).filter((value): value is number => value != null);
    let cursor = starts.length ? Math.min(...starts) : 9 * 60;
    const seen = new Set<string>();
    const next = day.events.map((event, index) => {
      const canonical = events.get(String(event.id));
      if (!canonical || seen.has(String(event.id))) throw new Error("Uma atividade mudou no backend. Recarregue o roteiro antes de editar.");
      seen.add(String(event.id));
      const end = cursor + duration(canonical);
      if (end >= 24 * 60) throw new Error(`As atividades do dia ${day.day_number} ultrapassam meia-noite. Remova uma atividade antes de salvar.`);
      const scheduled = { ...canonical, order_index: index, start_time: clock(cursor), end_time: clock(end) };
      cursor = end + TRANSFER_MINUTES;
      return scheduled;
    });
    const costs = next.map(event => event.estimated_cost == null ? NaN : Number(event.estimated_cost));
    return { ...source, events: next, estimated_cost: costs.every(Number.isFinite) ? costs.reduce((sum, cost) => sum + cost, 0) : source.estimated_cost };
  });
}
