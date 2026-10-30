import type { Itinerary, ItineraryDay } from "@/types/travel";
import { scheduleItineraryDays } from "./itinerary-schedule.ts";

function fingerprint(days: ItineraryDay[]) {
  return days
    .map(
      (day) =>
        `${day.id}:${day.events
          .map((event) => event.id)
          .sort()
          .join(",")}`,
    )
    .join("|");
}
export function localProgramKey(
  userId: number | undefined,
  itineraryId: string | number,
) {
  return `viajero.${userId ?? "guest"}.itinerary.${itineraryId}.program`;
}
export function readLocalProgram(itinerary: Itinerary, key: string): Itinerary {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return itinerary;
    const stored = JSON.parse(raw);
    if (
      stored.fingerprint !== fingerprint(itinerary.days ?? []) ||
      !Array.isArray(stored.days)
    )
      return itinerary;
    if (
      !stored.days.every(
        (day: ItineraryDay) =>
          day &&
          Array.isArray(day.events) &&
          day.events.every((event) => event && typeof event.title === "string"),
      )
    )
      return itinerary;
    const canonical = new Map((itinerary.days ?? []).flatMap(day => day.events).map(event => [String(event.id), event]));
    return { ...itinerary, days: stored.days.map((day: ItineraryDay) => ({ ...day, events: day.events.flatMap(event => {
      const source = canonical.get(String(event.id));
      return source ? [{ ...source, order_index: event.order_index, start_time: event.start_time, end_time: event.end_time }] : [];
    }) })) };
  } catch {
    return itinerary;
  }
}
export function saveLocalProgram(
  original: Itinerary,
  days: ItineraryDay[],
  key: string,
) {
  const next = scheduleItineraryDays(original, days);
  localStorage.setItem(
    key,
    JSON.stringify({
      fingerprint: fingerprint(original.days ?? []),
      days: next,
    }),
  );
  return next;
}
export function tripHasEnded(
  endDate: string | null | undefined,
  now = new Date(),
) {
  if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return false;
  const end = new Date(`${endDate}T23:59:59`);
  return Number.isFinite(end.getTime()) && now > end;
}
