import { MapPin, Clock, Star, ExternalLink } from "lucide-react";
import { useState } from "react";
import PoiFilter from "./poi-filter";

import type { Poi } from "@/lib/pois";

type PoiType =
  | "all"
  | "attraction"
  | "restaurant"
  | "activity"
  | "lodging";

const poiTypeLabel: Record<string, string> = {
  attraction: "Ponto turístico",
  restaurant: "Restaurante",
  activity: "Atividade",
  lodging: "Hospedagem",
};

const priceLevelLabel: Record<number, string> = {
  1: "$",
  2: "$$",
  3: "$$$",
  4: "$$$$",
};

interface PoiListProps {
  pois: Poi[];
  loading?: boolean;
}

function PoiCard({ poi }: { poi: Poi; }) {
  return (
    <div className="flex flex-col gap-3 bg-background border border-border rounded-2xl px-4 py-4 hover:bg-background transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-lg font-semibold text-foreground leading-snug">
            {poi.name}
          </h3>

          <span className="text-xs mt-1 text-primary font-medium">
            {poiTypeLabel[poi.poi_type] ?? poi.poi_type}
          </span>
        </div>

        {poi.source_url && (
          <a
            href={poi.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-sm gap-2 shrink-0 text-muted-foreground hover:text-strong transition-colors"
          >
            Acessar site
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>

      {poi.summary && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {poi.summary}
        </p>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {poi.rating > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3 fill-amber-400 text-amber-400 shrink-0" />
            <span>{Number(poi.rating).toFixed(1)}
            </span>
          </div>
        )}

        {poi.estimated_visit_minutes > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3 shrink-0" />
            <span>{poi.estimated_visit_minutes} min</span>
          </div>
        )}

        {poi.price_level > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <p>Custo:</p>
            <span>{priceLevelLabel[poi.price_level] ?? poi.price_level}
            </span>
          </div>
        )}

        {poi.address && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{poi.address}
            </span>
          </div>
        )}
      </div>

      {poi.opening_hours && (
        <p className="text-xs text-muted-foreground">
          Horário: {poi.opening_hours}
        </p>
      )}
    </div>
  );
}

export default function PoiList({ pois }: PoiListProps) {
  const [activeFilter, setActiveFilter] = useState<PoiType>("all");

  const filteredPois =
    activeFilter === "all"
      ? pois
      : pois.filter((poi) => poi.poi_type === activeFilter);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-foreground">
        Pontos de interesse
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {filteredPois.length}{" "}
          {filteredPois.length === 1 ? "local" : "locais"}
        </span>
      </h2>

      <PoiFilter activeFilter={activeFilter} onChange={setActiveFilter} />

      {filteredPois.length === 0 && <p role="status" className="rounded-card border border-border p-6 text-sm text-muted-foreground">Ainda não há locais disponíveis nesta categoria. Experimente outro filtro.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredPois.map((poi) => (
          <PoiCard key={poi.id} poi={poi} />
        ))}
      </div>
    </div>
  );
}