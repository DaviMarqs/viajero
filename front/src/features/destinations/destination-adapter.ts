import type { Destination } from "@/types/travel";

function positiveNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Keeps missing values unknown and distinguishes daily prices from trip totals. */
export function destinationCardData(destination: Destination) {
  const cost = destination.cost_profile;
  const profile = cost && typeof cost === "object" ? cost : null;
  const daily = positiveNumber(profile?.daily_budget_mid);
  const tags = destination.metadata?.tags ?? destination.tags;
  return {
    id: destination.id,
    name: destination.name,
    country: destination.country,
    summary: destination.summary || destination.description,
    image: destination.hero_image_url || destination.image_url || destination.image || destination.cover_image || "",
    tags: Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [],
    duration: positiveNumber(destination.duration_days ?? destination.duration),
    rating: positiveNumber(destination.average_rating ?? destination.rating),
    budget: daily ?? positiveNumber(destination.cost_from ?? destination.cost),
    budgetLabel: daily ? "Estimativa por dia" : "Estimativa de valores",
    currency: typeof profile?.currency_code === "string" ? profile.currency_code : "BRL",
  };
}
