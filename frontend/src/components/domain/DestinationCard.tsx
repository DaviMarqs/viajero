import { Link } from "react-router-dom";

import { Destination } from "../../api/types";
import { Card } from "../ui/Card";

export function DestinationCard({ destination }: { destination: Destination }) {
  return (
    <Card>
      <div className="destination-card">
        <div className="destination-image" style={{ backgroundImage: `url(${destination.hero_image_url || "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1200&auto=format&fit=crop"})` }} />
        <div>
          <p className="eyebrow">{destination.country}</p>
          <h3>{destination.name}</h3>
          <p>{destination.summary}</p>
          <div className="card-footer">
            <span>Rating {destination.average_rating}</span>
            <Link to={`/destinations/${destination.id}`}>View destination</Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

