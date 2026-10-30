import { Link } from "react-router-dom";
import { ArrowRight, Check, ListChecks, Star } from "lucide-react";
import { useMoney } from "@/contexts/currencyContext";
import { DestinationImage } from "@/features/destinations/destination-card";
import { itineraryPresentation, itineraryStatus } from "@/features/itineraries/itinerary-presentation";
import { tripDuration } from "@/lib/trip-dates";
import { planningPeriod } from "./planning-date";
import type { Destination, Itinerary } from "@/types/travel";

export function HomeItineraryCard({ itinerary, destinations, upcomingDays }: { itinerary: Itinerary; destinations: Destination[]; upcomingDays?: number }) {
  const { money } = useMoney();
  const visual = itineraryPresentation(itinerary, destinations);
  const duration = Number(itinerary.duration_days ?? itinerary.duration) || tripDuration(itinerary.start_date ?? "", itinerary.end_date ?? "");
  const activityCount = Array.isArray(itinerary.days) && itinerary.days.every(day => Array.isArray(day.events)) ? itinerary.days.reduce((total, day) => total + day.events.length, 0) : null;
  const reviews = itinerary.review_stats;
  return <article className="travel-card home-trip-card">
    <div className="relative">
      <DestinationImage src={visual.image} name={visual.location} className="home-trip-image" />
      {itinerary.generation_status !== "ready" && <span className="status-badge absolute left-4 top-4">{itineraryStatus(itinerary.generation_status)}</span>}
      {upcomingDays !== undefined && <span className="badge home-trip-countdown">em {upcomingDays} {upcomingDays === 1 ? "dia" : "dias"}</span>}
    </div>
    <div className="home-trip-body">
      <h3 className="travel-card-title"><Link className="travel-card-link" to={`/roteiros/${itinerary.id}`}>{visual.location === "Destino não informado" ? itinerary.title || itinerary.name || visual.location : visual.location}</Link></h3>
      <p className="home-trip-period">{planningPeriod(itinerary.start_date ?? "", itinerary.end_date ?? "").replace(new RegExp(` ${new Date().getFullYear()}`, "g"), "")} · {duration && duration > 0 ? `${duration} dias` : "Duração a definir"}</p>
      <p className="text-xs text-muted-foreground">{visual.country || "País não informado"}</p>
      <div className="home-trip-details">
        {itinerary.generation_status === "ready" && <p className="home-trip-detail"><Check aria-hidden="true" />Roteiro pronto</p>}
        {activityCount !== null && <p className="home-trip-detail"><ListChecks aria-hidden="true" />{activityCount} {activityCount === 1 ? "atividade" : "atividades"}</p>}
        {reviews && reviews.review_count > 0 && <p className="home-trip-detail"><Star aria-hidden="true" />{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(reviews.average_rating))} · {reviews.review_count} {reviews.review_count === 1 ? "avaliação" : "avaliações"}</p>}
      </div>
      <div className="home-trip-cost"><dl><dt>Custo conhecido das atividades</dt><dd>{money(itinerary.budget_total, itinerary.currency_code || "BRL")}</dd></dl><ArrowRight className="card-arrow" aria-hidden="true" /></div>
    </div>
  </article>;
}
