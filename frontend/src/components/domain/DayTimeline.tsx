import { ItineraryDay } from "../../api/types";
import { Card } from "../ui/Card";

export function DayTimeline({ day }: { day: ItineraryDay }) {
  return (
    <Card>
      <div className="stack">
        <div className="timeline-head">
          <strong>Day {day.day_number}</strong>
          <span>{day.estimated_cost}</span>
        </div>
        <h3>{day.title}</h3>
        <p>{day.summary}</p>
        <div className="timeline-events">
          {day.events.map((event) => (
            <div key={event.id} className="timeline-event">
              <strong>{event.title}</strong>
              <p>{event.description}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

