import type { EventKind, ItineraryDay, ItineraryEvent, PlaceLink, TripGuide } from "@/types/travel";

/** Link de busca no Google Maps para roteiros antigos, que ainda não têm `details.links`. */
export function eventLinks(event: ItineraryEvent, destinationName: string): PlaceLink[] {
  const links = event.details?.links?.filter(link => /^https?:\/\//.test(link.url)) ?? [];
  if (links.length > 0) return links;
  const kind = event.details?.kind;
  if (kind === "transport" || kind === "free_time") return [];
  const place = event.details?.place_name || (typeof event.poi?.name === "string" ? event.poi.name : "") || event.title;
  const query = [place, destinationName].filter(Boolean).join(", ");
  return [{ kind: "maps", label: "Ver no Google Maps", url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` }];
}

/** Lê o guia de `itinerary.metadata.trip_guide` (só roteiros gerados pelo pipeline têm). */
export function tripGuideOf(metadata: Record<string, unknown> | null | undefined): TripGuide | null {
  const guide = metadata?.trip_guide;
  return guide && typeof guide === "object" && !Array.isArray(guide) ? guide as TripGuide : null;
}

export const EVENT_KIND_LABELS: Record<EventKind | "other", string> = {
  attraction: "Passeios",
  meal: "Refeições",
  transport: "Transporte",
  lodging: "Hospedagem",
  activity: "Atividades",
  shopping: "Compras",
  nightlife: "Vida noturna",
  free_time: "Tempo livre",
  other: "Outros",
};

/**
 * Custo por categoria (tipo do evento), calculado no front para continuar valendo depois de edições.
 * Eventos sem tipo (roteiros antigos) entram em "Outros"; categorias zeradas ficam de fora.
 */
export function costByKind(days: ItineraryDay[] | null | undefined): Array<{ kind: EventKind | "other"; label: string; total: number }> {
  const totals = new Map<EventKind | "other", number>();
  for (const event of (days ?? []).flatMap(day => day.events ?? [])) {
    const cost = Number(event.estimated_cost);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    const kind = event.details?.kind && event.details.kind in EVENT_KIND_LABELS ? event.details.kind : "other";
    totals.set(kind, (totals.get(kind) ?? 0) + cost);
  }
  return [...totals.entries()]
    .map(([kind, total]) => ({ kind, label: EVENT_KIND_LABELS[kind], total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
}

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
