import type { ItineraryWithDestination } from "@/hooks/useItineraries";
import { formatCurrency, formatDuration } from "@/lib/utils";

type TripCardProps = {
  trip?: ItineraryWithDestination;
  itinerary?: ItineraryWithDestination;
  className?: string;
  [key: string]: any;
};

function getTripData(props: TripCardProps) {
  return props.trip || props.itinerary || (props as { data?: ItineraryWithDestination }).data;
}

export function TripCard(props: TripCardProps) {
  const trip = getTripData(props);

  if (!trip) {
    return null;
  }

  const title = trip.title || trip.name || "Roteiro";
  const location = trip.destinationData?.name || trip.destination_name || trip.city || trip.country || "";
  const image = trip.image_url || trip.image || "";
  const budget = formatCurrency(trip.budget_total ?? trip.cost ?? trip.cost_from);
  const duration = formatDuration(trip.duration_days ?? trip.duration);

  return (
    <article
      className={`overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 text-white shadow-lg ${props.className ?? ""}`}
    >
      <div className="grid gap-0 md:grid-cols-[220px_1fr]">
        <div className="min-h-52 bg-slate-800">
          {image ? (
            <img src={image} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-52 items-end bg-gradient-to-br from-cyan-500/30 via-slate-900 to-emerald-500/20 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Roteiro</p>
                <p className="mt-2 text-2xl font-semibold text-white">{title}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-sm text-slate-300">{location || "Destino não informado"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Orçamento</p>
                <p className="text-sm font-semibold text-cyan-300">{budget}</p>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-300">
              {trip.summary || trip.description || "Sem resumo disponível no momento."}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-sm text-slate-300">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Duração</p>
              <p className="mt-1 font-medium text-white">{duration}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Status</p>
              <p className="mt-1 font-medium text-white">{trip.generation_status || "Pronto"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">POIs</p>
              <p className="mt-1 font-medium text-white">{trip.pois?.length || trip.points_of_interest?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default TripCard;
