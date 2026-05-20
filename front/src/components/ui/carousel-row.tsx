import { useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import TripCard from '@/components/ui/trip-card'
import type { ItineraryWithDestination } from '@/hooks/useItineraries'

interface CarouselRowProps {
  title: string
  itineraries: ItineraryWithDestination[]
  onVerTodos?: () => void
  onView?: (id: number) => void
  onDetails?: (id: number) => void
}
export default function CarouselRow({
  title,
  itineraries,
  onVerTodos,
  onView,
  onDetails,
}: CarouselRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function scroll(direction: 'left' | 'right') {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({
      left: direction === 'right' ? 560 : -560,
      behavior: 'smooth',
    })
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => scroll('left')}
            className="p-1.5 rounded-full border border-neutral-200 hover:bg-neutral-100 transition-colors"
          >
            <ChevronRight className="size-4 rotate-180 text-neutral-500" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1.5 rounded-full border border-neutral-200 hover:bg-neutral-100 transition-colors"
          >
            <ChevronRight className="size-4 text-neutral-500" />
          </button>
          {onVerTodos && (
            <button
              onClick={onVerTodos}
              className="text-sm text-blue-600 hover:underline"
            >
              Ver todos
            </button>
          )}
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {itineraries.map((itinerary) => (
            <div key={itinerary.id} className="shrink-0">
              <TripCard
                itinerary={itinerary}
                onView={onView}
                onDetails={onDetails}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}