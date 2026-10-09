import { CalendarDays, Clock3, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DestinationImage } from '@/features/destinations/destination-card';
import { itineraryPresentation, itineraryStatus } from '@/features/itineraries/itinerary-presentation';
import { formatRating } from '@/lib/utils';
import type { Destination, Itinerary } from '@/types/travel';

function formatDate(value?: string | null) {
  if (!value) return 'Data a definir';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Data a definir' : new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function formatMoney(value: Itinerary['budget_total'], currency = 'BRL') {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return 'A definir';
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value)); }
  catch { return `${value} ${currency}`; }
}

export default function ItineraryCard({ itinerary, destinations = [] }: { itinerary: Itinerary; destinations?: Destination[] }) {
  const visual = itineraryPresentation(itinerary, destinations);
  const duration = Number(itinerary.duration_days ?? itinerary.duration);
  const title = itinerary.title || itinerary.name || 'Roteiro';
  const href = `/roteiros/${itinerary.id}`;
  const reviewCount = Number(itinerary.review_stats?.review_count ?? 0);
  const averageRating = Number(itinerary.review_stats?.average_rating ?? 0);
  return <article className="travel-card">
    <div className="relative">
      <Link to={href} aria-label={`Abrir roteiro: ${title}`} className="block focus-visible:outline-offset-[-4px]">
        <DestinationImage src={visual.image} name={visual.location} className="travel-card-media" />
      </Link>
      <span className="status-badge pointer-events-none absolute left-4 top-4" data-status={itinerary.generation_status}>
        {itineraryStatus(itinerary.generation_status)}
      </span>
      {reviewCount > 0 && <span className="badge pointer-events-none absolute right-4 top-4 bg-surface text-foreground shadow-control">
        <Star aria-hidden="true" className="size-3.5 fill-amber-500 text-amber-500" />{formatRating(averageRating)}
        <span className="text-muted-foreground">({reviewCount})</span>
        <span className="sr-only"> de 5, {reviewCount} {reviewCount === 1 ? 'avaliação' : 'avaliações'}</span>
      </span>}
    </div>
    <div className="travel-card-body">
      <div className="space-y-1.5">
        <p className="text-sm text-muted-foreground">{[visual.location, visual.country].filter(Boolean).join(', ')}</p>
        <h3 className="travel-card-title"><Link to={href} className="transition-colors hover:text-primary">{title}</Link></h3>
      </div>
      <p className="line-clamp-2 text-sm leading-6 text-strong">{itinerary.summary || 'Os detalhes estarão disponíveis quando seu roteiro estiver pronto.'}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-strong">
        <p className="inline-flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
          <span>{formatDate(itinerary.start_date)}{itinerary.end_date && <span className="sr-only"> at? {formatDate(itinerary.end_date)}</span>}</span>
        </p>
        <p className="inline-flex items-center gap-2"><Clock3 aria-hidden="true" className="size-4 text-muted-foreground" />{Number.isFinite(duration) && duration > 0 ? `${duration} dias` : 'Duração a definir'}</p>
      </div>
      <div className="travel-card-footer">
        <div className="space-y-1"><p className="text-xs text-muted-foreground">Orçamento da viagem</p>
          <p className="font-display text-lg font-semibold tabular-nums">{formatMoney(itinerary.budget_total, itinerary.currency_code || 'BRL')}</p>
        </div>
        <Button asChild variant="travel" size="lg"><Link to={href} aria-label={`Abrir roteiro: ${title}`}>Abrir roteiro</Link></Button>
      </div>
    </div>
  </article>;
}
