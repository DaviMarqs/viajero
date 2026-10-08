import type { ItineraryWithDestination } from "@/hooks/useItineraries";
import ItineraryCard from "@/pages/roteiros/itinerary-card";

type TripCardProps = {
  trip?: ItineraryWithDestination;
  itinerary?: ItineraryWithDestination;
  className?: string;
  [key: string]: unknown;
};

export function TripCard(props: TripCardProps) {
  const trip = props.trip || props.itinerary || (props as { data?: ItineraryWithDestination }).data;
  if (!trip) return null;
  return <div className={props.className}><ItineraryCard itinerary={trip} /></div>;
}
export default TripCard;
