import { Link } from "react-router-dom";
import { MapPin, Star } from "lucide-react";
import type { Destination } from "@/types/travel";
import { destinationCardData } from "./destination-adapter";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";

export function DestinationImage({ src, name, className = "" }: { src?: string | null; name: string; className?: string; }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <div className={`overflow-hidden bg-muted ${className}`}>
    {src && failedSource !== src ? <img src={src} alt={name} loading="lazy" className="h-full w-full object-cover" onError={() => setFailedSource(src)} /> : <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
      <MapPin aria-hidden="true" />
      <span className="text-sm">Imagem indisponível</span>
    </div>}
  </div>;
}

export function DestinationCard({ destination }: { destination: Destination; }) {
  const card = destinationCardData(destination);
  return <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-card border border-border bg-surface transition-shadow hover:shadow-card">
    <DestinationImage src={card.image} name={card.name} className="h-56" />
    <div className="flex flex-1 flex-col gap-3 p-6">
      <h3 className="text-xl">
        <Link className="hover:text-primary" to={`/destinos/${card.id}`}>{[card.name, card.country].filter(Boolean).join(", ")}
        </Link>
      </h3>
      {(card.duration || card.tags.length > 0) && <div className="flex flex-wrap gap-2">{card.duration && <span className="badge">{card.duration} dias</span>}{card.tags.slice(0, 3).map(tag => <span className="badge" key={tag}>{tag}
      </span>)}
      </div>}
      <p className="line-clamp-3 text-sm leading-relaxed text-strong">{card.summary || "Conheça as informações disponíveis sobre este destino."}
      </p>
      {card.rating && <p className="flex items-center gap-2 text-sm text-strong">
        <Star className="size-4 text-primary" aria-hidden="true" />{card.rating.toLocaleString("pt-BR")} / 5</p>}
      <div className="mt-auto pt-2">
        <p className="text-sm text-strong">{card.budgetLabel}
        </p>
        <p className="mt-1 font-display text-2xl font-semibold">{formatCurrency(card.budget, "pt-BR", card.currency)}
        </p>
      </div>
      <Link to={`/destinos/${card.id}`} className="mt-1 text-sm font-medium text-primary underline-offset-4 hover:underline" aria-label={`Ver destino: ${card.name}`}>Ver destino →</Link>
    </div>
  </article>;
}
