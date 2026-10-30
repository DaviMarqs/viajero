import { ArrowRight, CalendarDays, Clock3, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { DestinationImage } from "@/features/destinations/destination-card";
import {
  itineraryPresentation,
  itineraryStatus,
} from "@/features/itineraries/itinerary-presentation";
import { formatRating } from "@/lib/utils";
import type { Destination, Itinerary } from "@/types/travel";
import { useMoney } from "@/contexts/currencyContext";
import { FavoriteItineraryButton } from "@/features/itineraries/favorite-itinerary-button";
import { TravelCard } from "@/components/ui/travel-card";
import { TagList } from "@/components/ui/tag-list";
import { destinationCategories } from "@/lib/personalization";

function formatDate(value?: string | null) {
  if (!value) return "Data a definir";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "Data a definir"
    : new Intl.DateTimeFormat("pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

export default function ItineraryCard({
  itinerary,
  destinations = [],
  favoriteId,
  onRemoved,
  recommendationReason,
}: {
  itinerary: Itinerary;
  destinations?: Destination[];
  favoriteId?: number | string;
  onRemoved?: () => void;
  recommendationReason?: string;
}) {
  const { money } = useMoney();
  const visual = itineraryPresentation(itinerary, destinations);
  const duration = Number(itinerary.duration_days ?? itinerary.duration);
  const title = itinerary.title || itinerary.name || "Roteiro";
  const href = `/roteiros/${itinerary.id}`;
  const reviewCount = Number(itinerary.review_stats?.review_count ?? 0);
  const averageRating = Number(itinerary.review_stats?.average_rating ?? 0);
  return (
    <TravelCard variant="itinerary">
      <div className="relative">
        <DestinationImage src={visual.image} name={visual.location} className="travel-card-media" />
        <span
          className="status-badge pointer-events-none absolute left-4 top-4"
          data-status={itinerary.generation_status}
        >
          {itineraryStatus(itinerary.generation_status)}
        </span>
        {reviewCount > 0 && (
          <span className="badge pointer-events-none absolute right-4 top-4 bg-surface text-foreground">
            <Star
              aria-hidden="true"
              className="size-4 fill-current text-foreground"
            />
            {formatRating(averageRating)}
            <span className="text-muted-foreground">({reviewCount})</span>
            <span className="sr-only">
              {" "}
              de 5, {reviewCount}{" "}
              {reviewCount === 1 ? "avaliação" : "avaliações"}
            </span>
          </span>
        )}
      </div>
      <div className="travel-card-body">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {visual.country || "País não informado"}
          </p>
          <h3 className="travel-card-title">
            <Link to={href} className="travel-card-link">
              {title}
            </Link>
          </h3>
        </div>
        {visual.destination && <TagList tags={destinationCategories(visual.destination)} />}
        {recommendationReason && <p className="recommendation-reason">{recommendationReason}</p>}
        <p className="line-clamp-2 text-sm leading-6 text-strong">
          {itinerary.summary ||
            "Os detalhes estarão disponíveis quando seu roteiro estiver pronto."}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-mono text-strong">
          <p className="inline-flex items-center gap-2">
            <CalendarDays
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            <span>
              {formatDate(itinerary.start_date)}
              {itinerary.end_date && (
                <span className="sr-only">
                  {" "}
                  até {formatDate(itinerary.end_date)}
                </span>
              )}
            </span>
          </p>
          <p className="inline-flex items-center gap-2">
            <Clock3
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            {Number.isFinite(duration) && duration > 0
              ? `${duration} dias`
              : "Duração a definir"}
          </p>
        </div>
        <div className="travel-card-footer">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Custo conhecido das atividades</p>
            <p className="font-mono text-lg font-medium tabular-nums">
              {money(itinerary.budget_total, itinerary.currency_code || "BRL")}
            </p>
          </div>
          <div className="card-actions">
          {favoriteId != null && <FavoriteItineraryButton itineraryId={itinerary.id} initialFavoriteId={favoriteId} onRemoved={onRemoved} compact />}
          <ArrowRight className="card-arrow" aria-hidden="true" />
          </div>
        </div>
      </div>
    </TravelCard>
  );
}
