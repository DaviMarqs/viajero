export const DEFAULT_DURATION_DAYS = 5;

export interface ItineraryDefaultsInput {
  title?: string;
  duration_days?: number;
  budget_total?: number;
  currency_code?: string;
}

export interface TripPreferenceDefaults {
  preferred_trip_length_days: number;
  budget_min: string | number;
  budget_max: string | number;
  currency_code: string;
}

export interface ItineraryDefaults {
  title: string;
  duration_days: number;
  budget_total: string;
  currency_code: string;
}

/** Completa o roteiro como o Django fazia em ItineraryViewSet.perform_create. */
export function resolveItineraryDefaults(
  input: ItineraryDefaultsInput,
  preferences: TripPreferenceDefaults | null,
  destinationName: string,
): ItineraryDefaults {
  const preferredDays = preferences?.preferred_trip_length_days ?? 0;
  const durationFromPreferences = preferredDays >= 1 && preferredDays <= 60 ? preferredDays : DEFAULT_DURATION_DAYS;
  const budgetFromPreferences = preferences ? (Number(preferences.budget_min) + Number(preferences.budget_max)) / 2 : 0;
  const budget = input.budget_total ?? budgetFromPreferences;
  return {
    title: input.title?.trim() || `Roteiro ${destinationName}`,
    duration_days: input.duration_days ?? durationFromPreferences,
    budget_total: (Number.isFinite(budget) ? budget : 0).toFixed(2),
    currency_code: (input.currency_code ?? preferences?.currency_code ?? 'BRL').toUpperCase(),
  };
}

export interface ItineraryVisibility {
  generation_status: string;
  metadata?: Record<string, unknown> | null;
  review_stats?: { review_count: number } | null;
}

/** Publico = pronto e (avaliado ou template). A resposta nunca inclui dados do dono. */
export function isPublicItinerary(itinerary: ItineraryVisibility): boolean {
  if (itinerary.generation_status !== 'ready') return false;
  return (itinerary.review_stats?.review_count ?? 0) > 0 || itinerary.metadata?.is_template === true;
}

export function canViewItinerary(itinerary: ItineraryVisibility, isOwner: boolean): boolean {
  return isOwner || isPublicItinerary(itinerary);
}

export function canReviewItinerary(itinerary: ItineraryVisibility, isOwner: boolean): boolean {
  return itinerary.generation_status === 'ready' && canViewItinerary(itinerary, isOwner);
}
