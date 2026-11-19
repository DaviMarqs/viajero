import { BedDouble, Bus, CalendarCheck, Coffee, ExternalLink, Footprints, Globe, Landmark, Lightbulb, Map as MapIcon, MapPin, ShoppingBag, Sparkles, Star, Utensils, Wine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DestinationImage } from "@/features/destinations/destination-card";
import { useMoney } from "@/contexts/currencyContext";
import type { EventKind, ItineraryEvent, PlaceLink } from "@/types/travel";
import { activityDuration, eventLinks } from "./itinerary-insights";

const KIND_BADGES: Record<EventKind, { label: string; icon: LucideIcon }> = {
  attraction: { label: "Passeio", icon: Landmark },
  meal: { label: "Refeição", icon: Utensils },
  transport: { label: "Transporte", icon: Bus },
  lodging: { label: "Hospedagem", icon: BedDouble },
  activity: { label: "Atividade", icon: Sparkles },
  shopping: { label: "Compras", icon: ShoppingBag },
  nightlife: { label: "Vida noturna", icon: Wine },
  free_time: { label: "Tempo livre", icon: Coffee },
};

const LINK_ICONS: Record<PlaceLink["kind"], LucideIcon> = { maps: MapPin, website: Globe, reviews: Star, osm: MapIcon };

function imageFrom(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata as Record<string, unknown> : {};
  return [record.image_url, record.image, record.photo_url, metadata.image_url, metadata.photo_url].find((item): item is string => typeof item === "string" && !!item);
}

const percent = (factor: number) => {
  const change = Math.round((factor - 1) * 1000) / 10;
  return `${change > 0 ? "+" : ""}${change.toLocaleString("pt-BR")}%`;
};

export function ItineraryActivity({ event, currency, destinationName, as: Tag = "li" }: {
  as?: "li" | "div"; event: ItineraryEvent; index: number; currency: string; destinationImage?: string; destinationName: string;
}) {
  const { money } = useMoney();
  const details = event.details ?? {};
  const photo = details.image_url || imageFrom(event) || imageFrom(event.poi);
  const credit = details.image_url ? details.image_credit : undefined;
  const start = event.start_time?.slice(0, 5);
  const end = event.end_time?.slice(0, 5);
  const duration = activityDuration(event);
  const address = typeof event.poi?.address === "string" && event.poi.address ? event.poi.address : details.location;
  const badge = details.kind ? KIND_BADGES[details.kind] : undefined;
  const transit = details.transit_to_next;
  const links = eventLinks(event, destinationName);
  const costSource = details.cost_source;
  const hasCost = event.estimated_cost != null && event.estimated_cost !== "";
  const KindIcon = badge?.icon;
  return <Tag className="itinerary-activity" data-kind={details.kind}>
    <div className="activity-schedule">
      <p className="activity-time">{start ? <time dateTime={start}>{start}</time> : "Horário a definir"}{end && <><span aria-hidden="true">–</span><time dateTime={end}>{end}</time></>}</p>
    </div>
    <div className="activity-content">
      {(badge || details.booking_required) && <p className="activity-badges">
        {badge && <span className="activity-badge"><badge.icon className="size-3.5" aria-hidden="true" />{badge.label}</span>}
        {details.booking_required && <span className="activity-badge" data-tone="warning"><CalendarCheck className="size-3.5" aria-hidden="true" />Reserva necessária</span>}
      </p>}
      <h3 className="text-lg">{event.title}</h3>
      <p className="activity-duration">{duration ? `${duration.minutes} min · ${duration.estimated ? "duração estimada" : "duração programada"}` : "Duração não informada"}</p>
      <p className="copy-measure text-sm leading-6 text-strong">{event.description || "Sem descrição para esta atividade."}</p>
      {address && <p className="flex items-start gap-2 text-xs text-muted-foreground"><MapPin className="size-4 shrink-0" aria-hidden="true" />{address}</p>}
      {(details.rating || details.price_tier) && <p className="activity-place-meta">
        {details.rating && <span><Star className="size-3.5" aria-hidden="true" />{details.rating.value.toLocaleString("pt-BR")}/{details.rating.scale} · {details.rating.provider}</span>}
        {details.price_tier && <span aria-label={`Faixa de preço ${details.price_tier.tier} de 4 segundo ${details.price_tier.provider}`}>{"$".repeat(details.price_tier.tier)} · faixa de preço segundo {details.price_tier.provider}</span>}
      </p>}
      {details.tip && <p className="flex items-start gap-2 text-xs text-muted-foreground"><Lightbulb className="size-4 shrink-0" aria-hidden="true" /><span><span className="sr-only">Dica: </span>{details.tip}</span></p>}
      {details.booking_note && <p className="text-xs text-muted-foreground">{details.booking_note}</p>}
      <div className="activity-cost-block">
        <p className="activity-cost"><span className="text-muted-foreground">{hasCost ? "Custo estimado" : "Custo não informado"}</span><span className="font-mono tabular-nums">{hasCost ? money(event.estimated_cost, currency) : "—"}</span></p>
        {hasCost && costSource && <p className="activity-cost-source">
          {costSource.source_url ? <a href={costSource.source_url} target="_blank" rel="noreferrer noopener">{costSource.label}</a> : costSource.label}
          {costSource.reference && <> · referência {money(costSource.reference, currency)}{costSource.travelers ? ` por pessoa × ${costSource.travelers}` : ""}</>}
          {costSource.adjusted && <> · valor original {money(costSource.adjusted.original, currency)}, ajustado ao seu orçamento ({percent(costSource.adjusted.factor)})</>}
        </p>}
      </div>
      {links.length > 0 && <p className="activity-links">{links.map(link => {
        const Icon = LINK_ICONS[link.kind] ?? ExternalLink;
        return <a key={link.url} href={link.url} target="_blank" rel="noreferrer noopener"><Icon className="size-3.5" aria-hidden="true" />{link.label}<span className="sr-only"> (abre em nova aba)</span></a>;
      })}</p>}
      {transit && <p className="activity-transit"><Footprints className="size-3.5 shrink-0" aria-hidden="true" />→ {transit.minutes ? `${transit.minutes} min ` : ""}{transit.mode} até a próxima atividade{transit.note ? ` · ${transit.note}` : ""}</p>}
    </div>
    {photo ? <figure className="activity-photo">
      <DestinationImage src={photo} name={event.title} className="h-full w-full" />
      {credit && <figcaption className="activity-photo-credit">Foto: {credit.url ? <a href={credit.url} target="_blank" rel="noreferrer noopener">{credit.label}</a> : credit.label}</figcaption>}
    </figure> : KindIcon && <div className="activity-photo activity-photo-placeholder" aria-hidden="true"><KindIcon className="size-8" /></div>}
  </Tag>;
}
