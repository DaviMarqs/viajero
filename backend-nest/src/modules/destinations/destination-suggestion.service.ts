import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Destination } from './entities';
import { DestinationsService } from './destinations.service';
import { pickSuggestedDestination } from './destination-suggestion';
import { ProfilesService } from '../profiles/profiles.service';
import { Itinerary } from '../itineraries/entities';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DestinationSuggestionService {
  constructor(
    private readonly destinations: DestinationsService,
    private readonly profiles: ProfilesService,
    @InjectRepository(Itinerary) private readonly itineraries: Repository<Itinerary>,
    private readonly audit: AuditService,
  ) {}

  async suggest(userId: number): Promise<Destination> {
    const [candidates, profile, preferences, used] = await Promise.all([
      this.destinations.list(),
      this.profiles.getDna(userId),
      this.profiles.getTripPreference(userId),
      this.itineraries.find({ select: { id: true, destination: { id: true } }, where: { user: { id: userId } }, relations: { destination: true } }),
    ]);
    const choice = pickSuggestedDestination(candidates, profile, preferences, used.map((itinerary) => Number(itinerary.destination.id)));
    if (!choice) throw new NotFoundException('Nenhum destino disponivel para sugerir no momento.');
    await this.audit.log({
      event_type: 'destination.suggested',
      actor_id: userId,
      content_type: 'Destination',
      object_id: String(choice.destination.id),
      metadata: { score: Number(choice.score.toFixed(3)) },
    });
    return choice.destination;
  }
}
