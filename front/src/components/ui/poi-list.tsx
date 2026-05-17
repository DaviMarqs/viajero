import {
  MapPin,
  Clock,
  Star,
  ExternalLink,
} from "lucide-react";

import type { Poi } from "@/lib/pois";

const poiTypeLabel: Record<string, string> = {
  attraction: "Atração",
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

function PoiCard({ poi }: { poi: Poi }) {
  return (
    <div className="flex flex-col gap-3 bg-neutral-50 border border-neutral-100 rounded-2xl px-4 py-4 hover:bg-neutral-100 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-neutral-900 leading-snug">
            {poi.name}
          </h3>

          <span className="text-xs text-blue-600 font-medium">
            {poiTypeLabel[poi.poi_type] ?? poi.poi_type}
          </span>
        </div>

        {poi.source_url && (
          <a
            href={poi.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>

      {poi.summary && (
        <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
          {poi.summary}
        </p>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {poi.rating > 0 && (
          <div className="flex items-center gap-1 text-xs text-neutral-500">
            <Star className="size-3 fill-amber-400 text-amber-400 shrink-0" />

            <span>{Number(poi.rating).toFixed(1)}</span>
          </div>
        )}

        {poi.estimated_visit_minutes > 0 && (
          <div className="flex items-center gap-1 text-xs text-neutral-500">
            <Clock className="size-3 shrink-0" />

            <span>{poi.estimated_visit_minutes} min</span>
          </div>
        )}

        {poi.price_level > 0 && (
          <div className="flex items-center gap-1 text-xs text-neutral-500">
            <p>Custo:</p>

            <span>
              {priceLevelLabel[poi.price_level] ??
                poi.price_level}
            </span>
          </div>
        )}

        {poi.address && (
          <div className="flex items-center gap-1 text-xs text-neutral-500">
            <MapPin className="size-3 shrink-0" />

            <span className="truncate">{poi.address}</span>
          </div>
        )}
      </div>

      {poi.opening_hours && (
        <p className="text-xs text-neutral-400">
          Horário: {poi.opening_hours}
        </p>
      )}
    </div>
  );
}

export default function PoiList({
  pois,
  loading,
}: PoiListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-neutral-900">
          Pontos de interesse
        </h2>

        <p className="text-sm text-neutral-400">
          Carregando...
        </p>
      </div>
    );
  }

  if (pois.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-neutral-900">
          Pontos de interesse
        </h2>

        <p className="text-sm text-neutral-400">
          Nenhum ponto encontrado.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-neutral-900">
        Pontos de interesse

        <span className="ml-2 text-xs font-normal text-neutral-400">
          {pois.length}{" "}
          {pois.length === 1 ? "local" : "locais"}
        </span>
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pois.map((poi) => (
          <PoiCard key={poi.id} poi={poi} />
        ))}
      </div>
    </div>
  );
}