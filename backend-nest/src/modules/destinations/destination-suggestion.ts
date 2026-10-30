import { Destination, PointOfInterest } from './entities';
import { TravelerDnaProfile, UserTripPreference } from '../profiles/entities';

type Category = 'culture' | 'food' | 'nature' | 'nightlife' | 'shopping' | 'wellness' | 'adventure';

type PoiLike = Pick<PointOfInterest, 'poi_type'> & { tags?: Array<{ slug: string }> | null };
export type SuggestionCandidate = Pick<Destination, 'id' | 'name' | 'average_rating'> & { pois?: PoiLike[] | null };
export type SuggestionProfile = Pick<
  TravelerDnaProfile,
  'cultural_interest' | 'food_focus' | 'nature_interest' | 'nightlife_interest' | 'adventure_level'
> | null;
export type SuggestionPreferences = Pick<UserTripPreference, 'interests'> | null;

const hasTag = (poi: PoiLike, ...slugs: string[]) => (poi.tags ?? []).some((tag) => slugs.includes(tag.slug));

// Interesses do onboarding (food, culture, ...) -> POIs que os atendem (tags do seed).
const CATEGORY_MATCHERS: Record<Category, (poi: PoiLike) => boolean> = {
  culture: (poi) => hasTag(poi, 'cultura', 'historia'),
  food: (poi) => hasTag(poi, 'gastronomia'),
  nature: (poi) => hasTag(poi, 'natureza', 'praia'),
  nightlife: (poi) => hasTag(poi, 'noturno'),
  shopping: (poi) => hasTag(poi, 'compras'),
  wellness: (poi) => hasTag(poi, 'praia'),
  adventure: (poi) => poi.poi_type === 'activity',
};
const CATEGORIES = Object.keys(CATEGORY_MATCHERS) as Category[];

function categoryWeights(profile: SuggestionProfile, preferences: SuggestionPreferences): Record<Category, number> {
  const scale = (value: number | undefined) => (profile && value !== undefined ? value / 10 : 0.5);
  const weights: Record<Category, number> = {
    culture: scale(profile?.cultural_interest),
    food: scale(profile?.food_focus),
    nature: scale(profile?.nature_interest),
    nightlife: scale(profile?.nightlife_interest),
    adventure: scale(profile?.adventure_level),
    shopping: 0,
    wellness: 0,
  };
  for (const interest of preferences?.interests ?? []) {
    if (interest in weights) weights[interest as Category] += 0.5;
  }
  return weights;
}

function scoreDestination(destination: SuggestionCandidate, weights: Record<Category, number>): number {
  const pois = destination.pois ?? [];
  const affinity = CATEGORIES.reduce((total, category) => {
    const matches = pois.filter(CATEGORY_MATCHERS[category]).length;
    return total + weights[category] * Math.min(1, matches / 2);
  }, 0);
  return affinity + (0.5 * (Number(destination.average_rating) || 0)) / 5;
}

/** Destino com maior afinidade com DNA/interesses, evitando os ja usados pelo usuario. */
export function pickSuggestedDestination<T extends SuggestionCandidate>(
  candidates: T[],
  profile: SuggestionProfile,
  preferences: SuggestionPreferences,
  usedDestinationIds: number[],
): { destination: T; score: number } | null {
  const fresh = candidates.filter((item) => !usedDestinationIds.includes(Number(item.id)));
  const pool = fresh.length > 0 ? fresh : candidates;
  const weights = categoryWeights(profile, preferences);
  const ranked = pool
    .map((destination) => ({ destination, score: scoreDestination(destination, weights) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.destination.average_rating) - Number(a.destination.average_rating) ||
        a.destination.name.localeCompare(b.destination.name, 'pt-BR'),
    );
  return ranked[0] ?? null;
}
