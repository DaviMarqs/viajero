import { Clock3, MapPin } from "lucide-react";
import { DestinationImage } from "@/features/destinations/destination-card";
import { useMoney } from "@/contexts/currencyContext";
import type { ItineraryEvent } from "@/types/travel";

function imageFrom(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata as Record<string, unknown> : {};
  return [record.image_url, record.image, record.photo_url, metadata.image_url, metadata.photo_url].find((item): item is string => typeof item === "string" && !!item);
}
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function ItineraryActivity({ event, index, currency, destinationImage, destinationName, as: Tag = "li" }: {
  as?: "li" | "div"; event: ItineraryEvent; index: number; currency: string; destinationImage?: string; destinationName: string;
}) {
  const { money } = useMoney();
  const photo = imageFrom(event) || imageFrom(event.poi);
  const suggested = !event.start_time;
  const start = event.start_time?.slice(0, 5) || clock(9 * 60 + index * 180);
  const end = event.end_time?.slice(0, 5);
  const suggestedEnd = !event.start_time && !end ? clock(10 * 60 + 30 + index * 180) : undefined;
  const address = typeof event.poi?.address === "string" ? event.poi.address : undefined;
  return <Tag className="itinerary-activity">
    <div className="activity-photo">
      <DestinationImage src={photo || destinationImage} name={photo ? event.title : destinationName} className="h-full w-full" />
      {!photo && destinationImage && <span className="activity-photo-caption">Foto do destino</span>}
    </div>
    <div className="activity-content">
      <div className="flex flex-wrap items-center gap-2">
        <p className="activity-time"><Clock3 className="size-4" aria-hidden="true" /><time dateTime={start}>{start}</time>{(end || suggestedEnd) && <><span aria-hidden="true">–</span><time dateTime={end || suggestedEnd}>{end || suggestedEnd}</time></>}</p>
        {suggested && <span className="badge">Horário sugerido</span>}
      </div>
      <h4 className="text-lg">{event.title}</h4>
      <p className="max-w-[65ch] text-sm leading-6 text-strong">{event.description || "Sem descrição para esta atividade."}</p>
      {address && <p className="flex items-start gap-2 text-xs text-muted-foreground"><MapPin className="size-4 shrink-0" aria-hidden="true" />{address}</p>}
      <p className="activity-cost"><span className="text-muted-foreground">Custo estimado</span><span className="font-medium tabular-nums">{money(event.estimated_cost, currency)}</span></p>
    </div>
  </Tag>;
}
