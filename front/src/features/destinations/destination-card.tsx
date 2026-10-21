import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { useState } from "react";
import type { Destination } from "@/types/travel";
import { destinationCardData } from "./destination-adapter";
import { useMoney } from "@/contexts/currencyContext";
import { TagList } from "@/components/ui/tag-list";
import { TravelCard } from "@/components/ui/travel-card";

export function DestinationImage({
  src,
  name,
  className = "",
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  return (
    <div className={`overflow-hidden bg-muted ${className}`}>
      {src && failedSource !== src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          className="destination-image h-full w-full object-cover"
          data-loaded={loadedSource === src}
          onLoad={() => setLoadedSource(src)}
          onError={() => setFailedSource(src)}
        />
      ) : (
        <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
          <MapPin aria-hidden="true" className="size-6" />
          <span className="text-sm">Imagem indisponível</span>
        </div>
      )}
    </div>
  );
}

export function DestinationCard({ destination, recommendationReason, compact = false }: { destination: Destination; recommendationReason?: string; compact?: boolean }) {
  const { money } = useMoney();
  const card = destinationCardData(destination);
  const href = `/destinos/${card.id}`;
  return (
    <TravelCard variant={compact ? "dna" : "destination"}>
      <DestinationImage src={card.image} name={card.name} className="travel-card-media" />
      <div className="travel-card-body">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-sm text-muted-foreground">
              {card.country || "Destino"}
            </p>
            <h3 className="travel-card-title">
              <Link className="travel-card-link" to={href}>
                {card.name}
              </Link>
            </h3>
          </div>
          {card.rating && (
            <p
              className="flex shrink-0 items-center gap-2 pt-8 text-xs font-mono"
              aria-label={`Avaliação ${card.rating.toLocaleString("pt-BR")} de 5`}
            >
              <Star className="size-3.5 fill-current" aria-hidden="true" />
              {card.rating.toLocaleString("pt-BR")}
            </p>
          )}
        </div>
        {card.duration && <p className="text-xs font-mono text-muted-foreground">{card.duration} dias sugeridos</p>}
        {card.tags.length > 0 && <TagList tags={card.tags} />}
        {recommendationReason && <p className="recommendation-reason">{recommendationReason}</p>}
        {!compact && <p className="line-clamp-2 text-sm leading-6 text-strong">
          {card.summary ||
            "Conheça as informações disponíveis sobre este destino."}
        </p>}
        <div className="travel-card-footer">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{card.budgetLabel}</p>
            <p className="font-mono text-lg font-medium tabular-nums">
              {money(card.budget, card.currency)}
            </p>
          </div>
          <ArrowRight className="card-arrow" aria-hidden="true" />
        </div>
      </div>
    </TravelCard>
  );
}
