import { Clock3, MapPin } from "lucide-react";
import { DestinationImage } from "@/features/destinations/destination-card";
import { useMoney } from "@/contexts/currencyContext";
import type { ItineraryEvent } from "@/types/travel";
import { activityDuration } from "./itinerary-insights";

function imageFrom(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata as Record<string, unknown> : {};
  return [record.image_url, record.image, record.photo_url, metadata.image_url, metadata.photo_url].find((item): item is string => typeof item === "string" && !!item);
}

export function ItineraryActivity({ event, currency, destinationImage, destinationName, as: Tag = "li" }: {
  as?: "li" | "div"; event: ItineraryEvent; index: number; currency: string; destinationImage?: string; destinationName: string;
}) {
  const { money } = useMoney();
  const photo = imageFrom(event) || imageFrom(event.poi);
  const start = event.start_time?.slice(0, 5);
  const end = event.end_time?.slice(0, 5);
  const duration = activityDuration(event);
  const address = typeof event.poi?.address === "string" ? event.poi.address : undefined;
  return <Tag className="itinerary-activity">
    <div className="activity-photo">
      <DestinationImage src={photo || destinationImage} name={photo ? event.title : destinationName} className="h-full w-full" />
      {!photo && destinationImage && <span className="activity-photo-caption">Foto do destino</span>}
    </div>
    <div className="activity-content">
      <div className="flex flex-wrap items-center gap-2">
        <p className="activity-time"><Clock3 className="size-4" aria-hidden="true" />{start ? <time dateTime={start}>{start}</time> : "Horário a definir"}{end && <><span aria-hidden="true">–</span><time dateTime={end}>{end}</time></>}</p>
        <span className="text-xs text-strong">{duration ? `${duration.minutes} min${duration.estimated ? " de visita estimada" : " programados"}` : "Duração não informada"}</span>
      </div>
      <h4 className="text-lg">{event.title}</h4>
      <p className="max-w-[65ch] text-sm leading-6 text-strong">{event.description || "Sem descrição para esta atividade."}</p>
      {address && <p className="flex items-start gap-2 text-xs text-muted-foreground"><MapPin className="size-4 shrink-0" aria-hidden="true" />{address}</p>}
      <p className="activity-cost"><span className="text-muted-foreground">Custo estimado</span><span className="font-medium tabular-nums">{event.estimated_cost == null || event.estimated_cost === "" ? "Não informado" : money(event.estimated_cost, currency)}</span></p>
    </div>
  </Tag>;
}
