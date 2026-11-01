import type { Destination, Itinerary } from "@/types/travel";
import type { TravelerDNAProfile } from "@/lib/profiles";

export function travelTagLabel(value: string): string {
  const key = value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const labels: Record<string, string> = { familia: "Família", family: "Família", nature: "Natureza", natureza: "Natureza", history: "História", historia: "História", culture: "Cultura", cultura: "Cultura", cultural: "Cultura", food: "Gastronomia", shopping: "Compras", adventure: "Aventura", nightlife: "Vida noturna", noturno: "Vida noturna", beach: "Praia", wellness: "Relaxamento" };
  return labels[key] ?? value;
}

export function destinationCategories(destination: Destination): string[] {
  return [
    ...new Set([
      ...(Array.isArray(destination.metadata?.tags)
        ? destination.metadata.tags.filter((tag): tag is string => typeof tag === "string")
        : []),
      ...(Array.isArray(destination.tags)
        ? destination.tags.filter((tag): tag is string => typeof tag === "string")
        : []),
      ...(destination.pois ?? []).flatMap((poi) =>
        (poi.tags ?? []).map((tag) => tag.name),
      ),
    ]),
  ].map(travelTagLabel).filter((tag, index, tags) => tags.indexOf(tag) === index);
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
function matchingPreferences(destination: Destination, profile: TravelerDNAProfile | null) {
  if (!profile) return [];
  const interests = [
    { categories: ["cultura", "historia", "cultural"], label: "cultura", score: Number(profile.cultural_interest) || 0 },
    { categories: ["gastronomia", "food"], label: "gastronomia", score: Number(profile.food_focus) || 0 },
    { categories: ["natureza", "praia", "nature"], label: "natureza", score: Number(profile.nature_interest) || 0 },
    { categories: ["noturno", "nightlife", "vida noturna"], label: "vida noturna", score: Number(profile.nightlife_interest) || 0 },
    { categories: ["aventura", "adventure"], label: "aventura", score: Number(profile.adventure_level) || 0 },
  ];
  const highest = Math.max(...interests.map(({ score }) => score));
  const categories = destinationCategories(destination).map(normalize);
  return interests
    .filter(({ score }) => score >= 6 || (highest < 6 && score > 0 && score === highest))
    .filter(({ categories: matches }) => matches.some((category) => categories.includes(category)))
    .sort((a, b) => b.score - a.score);
}

export function destinationAffinity(destination: Destination, profile: TravelerDNAProfile | null) {
  return matchingPreferences(destination, profile).reduce((score, interest) => score + interest.score, 0);
}

export function rankDestinations(
  destinations: Destination[],
  profile: TravelerDNAProfile | null,
) {
  return [...destinations].sort(
    (a, b) =>
      destinationAffinity(b, profile) - destinationAffinity(a, profile) ||
      Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0),
  );
}

/** Reasons use only destination categories and fixed preferences saved in the traveler's DNA. */
export function destinationRecommendationReason(destination: Destination, profile: TravelerDNAProfile | null): string {
  const matches = matchingPreferences(destination, profile).slice(0, 2);
  return matches.length ? `No seu DNA: ${matches.map(({ label, score }) => `${label} ${score}/10`).join(" e ")}.` : "";
}

export function itineraryDestination(
  itinerary: Itinerary,
  destinations: Destination[],
) {
  if (typeof itinerary.destination === "object" && itinerary.destination)
    return itinerary.destination;
  return destinations.find(
    (destination) => String(destination.id) === String(itinerary.destination),
  );
}
