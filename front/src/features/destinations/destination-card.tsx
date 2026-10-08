import { Link } from 'react-router-dom';
import { MapPin, Star } from 'lucide-react';
import { useState } from 'react';
import type { Destination } from '@/types/travel';
import { destinationCardData } from './destination-adapter';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function DestinationImage({ src, name, className = '' }: { src?: string | null; name: string; className?: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <div className={`overflow-hidden bg-muted ${className}`}>
    {src && failedSource !== src ? <img src={src} alt={name} loading="lazy" className="h-full w-full object-cover" onError={() => setFailedSource(src)} />
      : <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
        <MapPin aria-hidden="true" className="size-6" /><span className="text-sm">Imagem indisponível</span>
      </div>}
  </div>;
}

export function DestinationCard({ destination }: { destination: Destination }) {
  const card = destinationCardData(destination);
  const href = `/destinos/${card.id}`;
  return <article className="travel-card">
    <Link to={href} aria-label={`Conhecer ${card.name}`} className="block focus-visible:outline-offset-[-4px]">
      <DestinationImage src={card.image} name={card.name} className="travel-card-media" />
    </Link>
    <div className="travel-card-body">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm text-muted-foreground">{card.country || 'Destino'}</p>
          <h3 className="travel-card-title"><Link className="transition-colors hover:text-primary" to={href}>{card.name}</Link></h3>
        </div>
        {card.rating && <p className="flex shrink-0 items-center gap-1.5 pt-7 text-sm" aria-label={`Avaliação ${card.rating.toLocaleString('pt-BR')} de 5`}>
          <Star className="size-3.5 fill-current" aria-hidden="true" />{card.rating.toLocaleString('pt-BR')}
        </p>}
      </div>
      {(card.duration || card.tags.length > 0) && <div className="flex flex-wrap gap-2">
        {card.duration && <span className="badge">{card.duration} dias</span>}
        {card.tags.slice(0, 3).map(tag => <span className="badge" key={tag}>{tag}</span>)}
      </div>}
      <p className="line-clamp-2 text-sm leading-6 text-strong">{card.summary || 'Conheça as informações disponíveis sobre este destino.'}</p>
      <div className="travel-card-footer">
        <div className="space-y-1"><p className="text-xs text-muted-foreground">{card.budgetLabel}</p>
          <p className="font-display text-lg font-semibold tabular-nums">{formatCurrency(card.budget, 'pt-BR', card.currency)}</p>
        </div>
        <Button asChild variant="travel" size="lg"><Link to={href} aria-label={`Ver destino: ${card.name}`}>Ver destino</Link></Button>
      </div>
    </div>
  </article>;
}
