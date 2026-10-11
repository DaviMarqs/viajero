import type { Destination } from "@/types/travel";
import { destinationSearchTerms, normalizeDestinationText } from "./destination-language.ts";
import { destinationCategories } from "./personalization.ts";

export function filterDestinations(destinations: Destination[], query: string, country: string, categories: string[]): Destination[] {
  const tokens = normalizeDestinationText(query).split(/\s+/).filter(Boolean);
  return destinations.filter(destination => {
    const tags = destinationCategories(destination);
    const haystack = normalizeDestinationText([...destinationSearchTerms(destination), ...tags].join(" "));
    return tokens.every(token => haystack.includes(token)) && (!country || normalizeDestinationText(destination.country ?? "") === normalizeDestinationText(country)) && categories.every(category => tags.includes(category));
  });
}
