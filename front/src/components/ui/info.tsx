import { Sun, Clock, Globe, Star, DollarSign } from 'lucide-react'
import type { Destination } from '@/lib/destinations'

const seasonLabel: Record<string, string> = {
  spring: 'Primavera',
  summer: 'Verão',
  autumn: 'Outono',
  fall: 'Outono',
  winter: 'Inverno',
}

interface DestinationInfoProps {
  destination: Destination
}

export default function DestinationInfo({ destination }: DestinationInfoProps) {
  const season = seasonLabel[destination.best_season.toLowerCase()] ?? destination.best_season
  const ratingNum = Number(destination.average_rating)

  const items = [
    {
      label: 'Melhor época para visitar',
      value: season,
      icon: <Sun className="size-4" />,
    },
    {
      label: 'Fuso horário',
      value: destination.timezone,
      icon: <Clock className="size-4" />,
    },
    {
      label: 'Localização',
      value: `${destination.city}, ${destination.country}`,
      icon: <Globe className="size-4" />,
    },
    ...(ratingNum > 0 ? [{
      label: 'Avaliação',
      value: `${ratingNum.toFixed(1)} / 5.0`,
      icon: <Star className="size-4" />,
    }] : []),
    ...(destination.cost_profile ? [{
      label: 'Custo',
      value: destination.cost_profile,
      icon: <DollarSign className="size-4" />,
    }] : []),
  ]

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-neutral-900">Informações gerais</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 bg-neutral-50 hover:bg-neutral-100 transition-colors rounded-2xl px-4 py-3.5 border border-neutral-200"
          >
            <div className="shrink-0 mt-0.5 text-blue-500">{item.icon}</div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm text-neutral-600">{item.label}</p>
              <p className="text-sm font-medium text-neutral-800">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}