import type { ItineraryDay, ItineraryEvent } from "@/types/travel";

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
