import { Button } from "@/components/ui/button";
import { displayTripDate } from "@/lib/trip-dates";
import { TRAVEL_PREFERENCES_STEPS } from "@/pages/travel-preferences-onboarding/travel-preferences-onboarding.data";
import type { TripPreferenceUpsertInput } from "@/lib/profiles";
import type { Destination } from "@/types/travel";

function choice(stepKey: string, value: string) {
  const field = TRAVEL_PREFERENCES_STEPS.find(step => step.key === stepKey)?.fields.find(field => field.type === "cards");
  return field?.type === "cards" ? field.cards.find(card => String(card.value) === value)?.title ?? value : value;
}
function tags(key: string, values: string[]) {
  const field = TRAVEL_PREFERENCES_STEPS.flatMap(step => step.fields).find(field => field.type === "tags" && field.key === key);
  return values.map(value => field?.type === "tags" ? field.options.find(option => option.value === value)?.label ?? value : value).join(", ") || "Nenhuma informada";
}
export function TripReview({ destination, preferences, onEdit, onChangeDestination }: { destination: Destination; preferences: TripPreferenceUpsertInput; onEdit: (step: string) => void; onChangeDestination: () => void }) {
  const amount = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: preferences.currency_code }).format(value);
  const period = preferences.metadata.flexible_dates ? `${preferences.preferred_trip_length_days} dias, datas flexíveis` : `${displayTripDate(preferences.metadata.start_date)} a ${displayTripDate(preferences.metadata.end_date)} (${preferences.preferred_trip_length_days} dias)`;
  const monthField = TRAVEL_PREFERENCES_STEPS.flatMap(step => step.fields).find(field => field.type === "dropdown" && field.key === "travel_month");
  const month = monthField?.type === "dropdown" ? monthField.options.find(option => option.value === preferences.travel_month)?.label ?? preferences.travel_month : preferences.travel_month;
  const rows = [
    { title: "Destino", value: [destination.name, destination.country].filter(Boolean).join(", "), edit: onChangeDestination },
    { title: "Orçamento da viagem", value: `${amount(preferences.budget_min)} a ${amount(preferences.budget_max)}`, step: "budget" },
    { title: "Período", value: `${period}${preferences.metadata.flexible_dates ? ` · ${month}` : ""}`, step: "timing" },
    { title: "Companhia", value: choice("companionship", preferences.companionship), step: "companionship" },
    { title: "Hospedagem", value: choice("stay", preferences.hotel_level), step: "stay" },
    { title: "Deslocamento", value: choice("transport", preferences.transportation_style), step: "transport" },
    { title: "Interesses", value: tags("interests", preferences.interests), step: "interests" },
    { title: "Alimentação e acessibilidade", value: `${tags("dietary_preferences", preferences.dietary_preferences)}; ${tags("accessibility_needs", preferences.accessibility_needs)}`, step: "needs" },
  ];
  return <section aria-labelledby="trip-review-title" className="space-y-4"><div><h2 id="trip-review-title" className="section-title">Revise sua viagem</h2><p className="mt-2 text-sm text-muted-foreground">Confira as escolhas antes de gerar. Seu DNA de viajante permanece separado destas preferências.</p></div><dl className="trip-review-list">{rows.map(row => <div key={row.title} className="trip-review-row"><div><dt className="text-sm text-muted-foreground">{row.title}</dt><dd className="mt-1 text-sm font-medium">{row.value}</dd></div><Button type="button" variant="ghost" size="sm" aria-label={`Alterar ${row.title.toLowerCase()}`} onClick={row.edit ?? (() => onEdit(row.step!))}>Alterar</Button></div>)}</dl></section>;
}
