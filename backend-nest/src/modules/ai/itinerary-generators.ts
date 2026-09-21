import { Itinerary } from '../itineraries/entities';
import { PointOfInterest } from '../destinations/entities';
import { TravelerDnaProfile, UserTripPreference } from '../profiles/entities';
import { PromptTemplate } from './entities';
import { ItineraryComposite, ItineraryDayComposite, ItineraryEventLeaf } from '../itineraries/itinerary-composite';

export interface GeneratedItinerary {
  title: string;
  summary: string;
  currency_code: string;
  estimated_cost: string;
  days: Array<{ title: string; summary: string; events: Array<{ title: string; description: string; estimated_cost: string; order_index: number; poi_id?: number }> }>;
  metadata: Record<string, unknown>;
}

export abstract class BaseItineraryGenerator {
  abstract generate(input: {
    itinerary: Itinerary;
    profile: TravelerDnaProfile | null;
    preferences: UserTripPreference | null;
    pois: PointOfInterest[];
    promptTemplate: PromptTemplate | null;
  }): GeneratedItinerary;
}

export class MockItineraryGenerator extends BaseItineraryGenerator {
  generate(input: {
    itinerary: Itinerary;
    profile: TravelerDnaProfile | null;
    preferences: UserTripPreference | null;
    pois: PointOfInterest[];
    promptTemplate: PromptTemplate | null;
  }): GeneratedItinerary {
    const selectedPois = input.pois.slice(0, Math.max(input.itinerary.duration_days * 3, 1));
    const composite = new ItineraryComposite(input.itinerary.title || `${input.itinerary.destination.name} Adventure`);
    const days: GeneratedItinerary['days'] = [];

    for (let index = 0; index < input.itinerary.duration_days; index += 1) {
      const chunk = selectedPois.slice(index * 3, index * 3 + 3);
      const fallback = selectedPois.slice(0, 3);
      const pois = chunk.length > 0 ? chunk : fallback;
      const events = pois.map((poi, eventIndex) => ({
        title: poi.name,
        description: poi.summary || `Explore ${poi.name} in depth.`,
        estimated_cost: String(20 + eventIndex * 15),
        order_index: eventIndex,
        poi_id: Number(poi.id),
      }));
      const day = {
        title: `Day ${index + 1}: ${input.itinerary.destination.name}`,
        summary: `Balanced plan shaped for ${input.profile?.travel_style ?? 'flexible'} travel.`,
        events,
      };
      const dayComposite = new ItineraryDayComposite({ title: day.title, summary: day.summary, day_number: index + 1 });
      events.forEach((event) => dayComposite.add(new ItineraryEventLeaf(event)));
      composite.add(dayComposite);
      days.push(day);
    }

    return {
      title: composite.getTitle(),
      summary: `${input.itinerary.duration_days}-day itinerary for ${input.itinerary.destination.name}.`,
      currency_code: input.preferences?.currency_code ?? input.itinerary.currency_code,
      estimated_cost: composite.getEstimatedCost().toFixed(2),
      days,
      metadata: {
        generator: 'mock',
        template_key: input.promptTemplate?.key ?? null,
        poi_count: selectedPois.length,
        composite_total_cost: composite.toPlainObject().estimated_cost,
      },
    };
  }
}
