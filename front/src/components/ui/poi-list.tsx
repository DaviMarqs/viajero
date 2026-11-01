import { MapPin, Clock, Star, ExternalLink } from "lucide-react";
import { useState } from "react";
import PoiFilter from "./poi-filter";

import type { Poi } from "@/lib/pois";
import { DestinationImage } from "@/features/destinations/destination-card";
import { TagList } from "./tag-list";
import { Button } from "./button";

type PoiType = "all" | "attraction" | "restaurant" | "activity" | "lodging";

const poiTypeLabel: Record<string, string> = {
  attraction: "Ponto turístico",
  restaurant: "Restaurante",
  activity: "Atividade",
  lodging: "Hospedagem",
};

const priceLevelLabel: Record<number, string> = {
  1: "Econômico",
  2: "Acessível",
  3: "Moderado",
  4: "Alto",
  5: "Luxo",
};

interface PoiListProps {
  pois: Poi[];
  loading?: boolean;
}

function PoiCard({ poi }: { poi: Poi }) {
  return (
    <article className="poi-row">
      {typeof poi.metadata?.image_url === "string" && (
        <DestinationImage
          src={poi.metadata.image_url}
          name={poi.name}
          className="poi-thumbnail"
        />
      )}
      <div className="poi-body"><div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-lg font-medium text-foreground leading-snug">
            {poi.name}
          </h3>

          <span className="text-xs mt-1 text-muted-foreground">
            {poiTypeLabel[poi.poi_type] ?? poi.poi_type}
          </span>
        </div>

        {poi.source_url && (
          <Button asChild variant="ghost" size="icon-sm" className="shrink-0"><a
            href={poi.source_url}
            aria-label={`Consultar fonte: ${poi.name}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="size-4" />
          </a></Button>
        )}
      </div>

      {poi.summary && (
        <p className="text-sm text-strong leading-relaxed">{poi.summary}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {poi.rating > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3 shrink-0" />
            <span className="font-mono">{Number(poi.rating).toFixed(1)}</span>
          </div>
        )}

        {poi.estimated_visit_minutes > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3 shrink-0" />
            <span className="font-mono">{poi.estimated_visit_minutes} min · estimado</span>
          </div>
        )}

        {poi.price_level > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <p>Faixa de preço:</p>
            <span>{priceLevelLabel[poi.price_level] ?? poi.price_level}</span>
          </div>
        )}

        {poi.address && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span>{poi.address}</span>
          </div>
        )}
      </div>

      {poi.opening_hours && (
        <p className="text-xs text-muted-foreground">
          Horário: <span className="font-mono">{poi.opening_hours}</span>
        </p>
      )}
      {!!poi.tags?.length && (
        <TagList tags={poi.tags.map(tag => tag.name)} />
      )}
    </div></article>
  );
}

export default function PoiList({ pois }: PoiListProps) {
  const [activeFilter, setActiveFilter] = useState<PoiType>("all");

  const filteredPois =
    activeFilter === "all"
      ? pois
      : pois.filter((poi) => poi.poi_type === activeFilter);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="section-title">
        Experiências neste destino
        {" "}<span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
          {filteredPois.length} {filteredPois.length === 1 ? "local" : "locais"}
        </span>
      </h2>

      <PoiFilter activeFilter={activeFilter} onChange={setActiveFilter} />

      {filteredPois.length === 0 && (
        <p
          role="status"
          className="rounded-card border border-border p-6 text-sm text-muted-foreground"
        >
          Ainda não há locais disponíveis nesta categoria. Experimente outro
          filtro.
        </p>
      )}
      <div className="poi-list">
        {filteredPois.map((poi) => (
          <PoiCard key={poi.id} poi={poi} />
        ))}
      </div>
    </section>
  );
}
