import type { Itinerary, ItineraryDay, ItineraryEvent } from "@/types/travel";

function timeMinutes(value?: string | null): number | null {
  if (!value || !/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}
export function activityDuration(event: ItineraryEvent): { minutes: number; estimated: boolean } | null {
  const start = timeMinutes(event.start_time), end = timeMinutes(event.end_time);
  if (start != null && end != null && end > start) return { minutes: end - start, estimated: false };
  const estimate = Number(event.poi?.estimated_visit_minutes);
  return Number.isFinite(estimate) && estimate > 0 ? { minutes: Math.round(estimate), estimated: true } : null;
}
export function dayInsights(day?: ItineraryDay) {
  const events = day?.events ?? [];
  const durations = events.map(activityDuration);
  const knownCosts = events.filter(event => event.estimated_cost != null && event.estimated_cost !== "" && Number.isFinite(Number(event.estimated_cost)));
  return { activities: events.length, visitMinutes: durations.reduce((sum, value) => sum + (value?.minutes ?? 0), 0), missingDurations: durations.filter(value => !value).length, knownCost: knownCosts.reduce((sum, event) => sum + Number(event.estimated_cost), 0), missingCosts: events.length - knownCosts.length };
}
export function draftChanges(original: Itinerary, draft: Itinerary) {
  const source = new Map((original.days ?? []).map(day => [String(day.id), day]));
  let removed = 0, reorderedDays = 0;
  for (const day of draft.days ?? []) {
    const previous = source.get(String(day.id))?.events ?? [];
    const ids = new Set(day.events.map(event => String(event.id)));
    removed += previous.filter(event => !ids.has(String(event.id))).length;
    if (previous.filter(event => ids.has(String(event.id))).map(event => String(event.id)).join(",") !== day.events.map(event => String(event.id)).join(",")) reorderedDays++;
  }
  const detailsChanged = original.title !== draft.title || original.start_date !== draft.start_date || original.end_date !== draft.end_date;
  return { removed, reorderedDays, detailsChanged, changed: removed > 0 || reorderedDays > 0 || detailsChanged };
}
