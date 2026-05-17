import type { ItineraryWithDestination } from '@/hooks/useItineraries'
import { Calendar, Clock, Wallet } from 'lucide-react'

interface TripCardProps {
  itinerary: ItineraryWithDestination
  onView?: (id: number) => void
  onDetails?: (id: number) => void
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft:      { label: 'Rascunho',   className: 'bg-neutral-100 text-neutral-600' },
  generating: { label: 'Gerando...', className: 'bg-amber-100 text-amber-700' },
  ready:      { label: 'Pronto',     className: 'bg-green-100 text-green-700' },
}

export default function TripCard({ itinerary, onView, onDetails }: TripCardProps) {
  const status = statusConfig[itinerary.generation_status] ?? {
    label: itinerary.generation_status,
    className: 'bg-neutral-100 text-neutral-600',
  }

  const budget = Number(itinerary.budget_total).toLocaleString('pt-BR', {
    style: 'currency',
    currency: itinerary.currency_code,
  })

  const startDate = new Date(itinerary.start_date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })

  const endDate = new Date(itinerary.end_date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const imageUrl = itinerary.destinationData?.hero_image_url
    || `https://picsum.photos/seed/${itinerary.id}/400/240`

  const locationLabel = itinerary.destinationData
    ? `${itinerary.destinationData.city}, ${itinerary.destinationData.country}`
    : null

  return (
    <div className="flex flex-col border border-neutral-200 rounded-2xl overflow-hidden h-full bg-white w-full sm:w-80 shrink-0 transition-shadow hover:shadow-md">
      <div className="relative h-44 bg-neutral-100 shrink-0">
        <img
          src={imageUrl}
          alt={itinerary.title}
          className="w-full h-full object-cover"
        />
        <span className={`absolute top-3 right-3 text-xs font-medium px-2.5 py-1 rounded-full ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4 flex-1">
        <div>
          <h2 className="font-semibold text-base text-neutral-900 leading-snug line-clamp-1">
            {itinerary.title}
          </h2>
          {locationLabel && (
            <p className="text-xs text-neutral-400 mt-0.5">{locationLabel}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Calendar className="size-3.5 shrink-0" />
            <span>{startDate} → {endDate}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Clock className="size-3.5 shrink-0" />
            <span>{itinerary.duration_days} dias</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Wallet className="size-3.5 shrink-0" />
            <span>{budget}</span>
          </div>
        </div>

        {itinerary.summary && (
          <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
            {itinerary.summary}
          </p>
        )}

        <div className="flex gap-2 mt-auto pt-1">
          <button
            onClick={() => onView?.(itinerary.id)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            Ver roteiro
          </button>
          <button
            onClick={() => onDetails?.(itinerary.id)}
            className="flex-1 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-sm font-medium py-2.5 rounded-xl border border-neutral-200 transition-colors"
          >
            Detalhes
          </button>
        </div>
      </div>
    </div>
  )
}