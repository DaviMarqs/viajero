import { useState } from "react";
import { DestinationImage } from "@/features/destinations/destination-card";
import type { Destination } from "@/types/travel";

export function DestinationGallery({ destination, cover }: { destination: Destination; cover?: string }) {
  const [selected, setSelected] = useState(0);
  const extra = destination.metadata?.images;
  const photos = [...new Set([cover, ...(Array.isArray(extra) ? extra : []), ...(destination.pois ?? []).map(poi => poi.metadata?.image_url)].filter((value): value is string => typeof value === "string" && !!value))];
  return <div className="space-y-4">
    <DestinationImage src={photos[selected] || cover} name={destination.name} className="destination-gallery-main w-full rounded-3xl" />
    {photos.length > 1 && <div className="destination-gallery-thumbs">{photos.slice(0, 4).map((photo, index) => <button type="button" key={photo} aria-label={`Ver foto ${index + 1} de ${destination.name}`} aria-pressed={selected === index} className="overflow-hidden rounded-2xl ring-primary aria-pressed:ring-2" onClick={() => setSelected(index)}><DestinationImage src={photo} name={destination.name} className="h-full w-full" /></button>)}</div>}
  </div>;
}
