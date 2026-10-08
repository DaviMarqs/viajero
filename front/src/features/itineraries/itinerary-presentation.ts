import type { Destination, Itinerary } from '@/types/travel';
import { destinationCardData } from '@/features/destinations/destination-adapter';

/** Supports both nested destinations and the numeric foreign key returned by the API. */
export function itineraryPresentation(itinerary: Itinerary, destinations: Destination[] = []) {
  const nested = itinerary.destination && typeof itinerary.destination === 'object' ? itinerary.destination : null;
  const enriched = itinerary.destinationData && typeof itinerary.destinationData === 'object'
    ? itinerary.destinationData as Destination : null;
  const destination = nested ?? enriched ?? destinations.find(item => String(item.id) === String(itinerary.destination));
  const image = [itinerary.image_url, itinerary.image, itinerary.cover_image, itinerary.hero_image_url]
    .find((value): value is string => typeof value === 'string' && value.length > 0);
  return {
    destination,
    image: image || (destination ? destinationCardData(destination).image : ''),
    location: destination?.name || itinerary.destination_name || itinerary.city
      || (typeof itinerary.destination === 'string' && !/^\d+$/.test(itinerary.destination) ? itinerary.destination : '') || 'Destino não informado',
    country: destination?.country || itinerary.country,
  };
}

export function itineraryStatus(status?: string | null) {
  const labels: Record<string, string> = { draft: 'Rascunho', generating: 'Gerando', ready: 'Pronto', failed: 'Falhou' };
  return status ? labels[status] || status : 'Não informado';
}
