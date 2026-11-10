import type { Itinerary } from "@/types/travel";
export function tripMilestones(itinerary: Itinerary, day: number) {
  const prefs = itinerary.metadata?.trip_preferences as { metadata?: { arrival_time?: string; departure_time?: string } } | undefined;
  return [
    ...(day === 1 ? [{ kind: "arrival", date: itinerary.start_date, time: prefs?.metadata?.arrival_time }] : []),
    ...(day === itinerary.days?.[itinerary.days.length - 1]?.day_number ? [{ kind: "departure", date: itinerary.end_date, time: prefs?.metadata?.departure_time }] : []),
  ];
}
