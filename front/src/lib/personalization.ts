import type { Destination, Itinerary } from "@/types/travel";
import type { TravelerDNAProfile } from "@/lib/profiles";

export function travelTagLabel(value: string): string {
  const key = value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const labels: Record<string, string> = { familia: "Família", family: "Família", nature: "Natureza", natureza: "Natureza", history: "História", historia: "História", culture: "Cultura", cultura: "Cultura", cultural: "Cultura", food: "Gastronomia", shopping: "Compras", adventure: "Aventura", nightlife: "Vida noturna", noturno: "Vida noturna", beach: "Praia", wellness: "Relaxamento" };
  return labels[key] ?? value;
}

export function destinationCategories(destination: Destination): string[] {
  const tags = destination.metadata?.tags ?? destination.tags;
  return [
    ...new Set([
      ...(Array.isArray(tags)
        ? tags.filter((tag): tag is string => typeof tag === "string")
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
export function destinationAffinity(
  destination: Destination,
  profile: TravelerDNAProfile | null,
) {
  if (!profile) return 0;
  const tags = destinationCategories(destination).map(normalize);
  const weights: [string[], number][] = [
    [["cultura", "historia", "cultural"], profile.cultural_interest],
    [["gastronomia", "food"], profile.food_focus],
    [["natureza", "praia", "nature"], profile.nature_interest],
    [["noturno", "nightlife", "vida noturna"], profile.nightlife_interest],
    [["aventura", "adventure"], profile.adventure_level],
  ];
  return (
    weights.reduce(
      (score, [matches, weight]) =>
        score +
        (tags.some((tag) => matches.includes(tag)) ? Number(weight) || 0 : 0),
      0,
    ) +
    ((destination.pois ?? []).some((poi) => poi.poi_type === "activity")
      ? (Number(profile.adventure_level) || 0) / 2
      : 0)
  );
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
