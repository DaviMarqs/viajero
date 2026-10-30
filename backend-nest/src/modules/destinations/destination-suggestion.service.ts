import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Destination } from './entities';
import { DestinationsService } from './destinations.service';
import { pickSuggestedDestination } from './destination-suggestion';
import { ProfilesService } from '../profiles/profiles.service';
import { Itinerary } from '../itineraries/entities';
import { AuditService } from '../audit/audit.service';
import { DestinationAiService } from './discovery/destination-ai.service';
import { DestinationDiscoveryService } from './discovery/destination-discovery.service';
import { UserTripPreference } from '../profiles/entities';
import { GenerationTripPreferenceDto } from '../itineraries/dto/generation-trip-preference.dto';
import { requireTripParameters } from '../itineraries/trip-generation-context';

@Injectable()
export class DestinationSuggestionService {
  constructor(
    private readonly destinations: DestinationsService,
    private readonly profiles: ProfilesService,
    @InjectRepository(Itinerary) private readonly itineraries: Repository<Itinerary>,
    private readonly audit: AuditService,
    private readonly ai: DestinationAiService,
    private readonly discovery: DestinationDiscoveryService,
  ) {}

  /**
   * Com chave de LLM, a IA escolhe o destino pelo perfil (paridade com o Django) e ele e buscado
   * no banco ou descoberto. Sem chave, ou se a IA falhar, cai na heuristica local por DNA/interesses.
   */
  async suggest(userId: number, tripParameters?: GenerationTripPreferenceDto): Promise<Destination> {
    const trip = tripParameters ? requireTripParameters(tripParameters) : undefined;
    const [profile, preferences, used] = await Promise.all([
      this.profiles.getDna(userId),
      trip ? Promise.resolve(Object.assign(new UserTripPreference(), trip, {
        budget_min: String(trip.budget_min), budget_max: String(trip.budget_max),
      })) : this.profiles.getTripPreference(userId),
      this.itineraries.find({ select: { id: true, destination: { id: true, name: true } }, where: { user: { id: userId } }, relations: { destination: true } }),
    ]);

    if (this.ai.isAvailable()) {
      const usedNames = [...new Set(used.map((itinerary) => itinerary.destination.name.trim()).filter(Boolean))];
      const suggestion = await this.ai.suggest(profile, preferences, usedNames);
      if (suggestion) {
        const destination =
          (await this.destinations.search({ q: suggestion.name }))[0] ??
          (await this.discoverSuggested(suggestion, userId));
        if (destination) {
          await this.audit.log({
            event_type: 'destination.suggested',
            actor_id: userId,
            content_type: 'Destination',
            object_id: String(destination.id),
            metadata: { suggested_name: suggestion.name, country: suggestion.country, city: suggestion.city, rationale: suggestion.rationale },
          });
          return destination;
        }
      }
    }

    const candidates = await this.destinations.list();
    const choice = pickSuggestedDestination(candidates, profile, preferences, used.map((itinerary) => Number(itinerary.destination.id)));
    if (!choice) throw new NotFoundException('Nenhum destino disponivel para sugerir no momento.');
    await this.audit.log({
      event_type: 'destination.suggested',
      actor_id: userId,
      content_type: 'Destination',
      object_id: String(choice.destination.id),
      metadata: { score: Number(choice.score.toFixed(3)), source: 'heuristic' },
    });
    return choice.destination;
  }

  private async discoverSuggested(suggestion: { name: string; country: string; city: string }, userId: number): Promise<Destination | null> {
    const id = await this.discovery.discover({ query: suggestion.name, country: suggestion.country, city: suggestion.city, actorId: userId });
    return id === null ? null : this.destinations.findOne(id);
  }
}
