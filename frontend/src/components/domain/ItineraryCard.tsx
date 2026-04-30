import { Link } from "react-router-dom";

import { Itinerary } from "../../api/types";
import { Card } from "../ui/Card";

export function ItineraryCard({ itinerary }: { itinerary: Itinerary }) {
  return (
    <Card>
      <div className="stack">
        <p className="eyebrow">{itinerary.generation_status}</p>
        <h3>{itinerary.title}</h3>
        <p>{itinerary.summary}</p>
        <div className="card-footer">
          <span>
            {itinerary.duration_days} days · {itinerary.currency_code} {itinerary.budget_total}
          </span>
          <Link to={`/itineraries/${itinerary.id}`}>Open itinerary</Link>
        </div>
      </div>
    </Card>
  );
}

