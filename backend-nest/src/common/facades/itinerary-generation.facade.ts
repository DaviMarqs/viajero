import { Injectable } from '@nestjs/common';
import { Itinerary } from '../../modules/itineraries/entities';
import { LlmJob } from '../../modules/ai/entities';
import { AiService } from '../../modules/ai/ai.service';

@Injectable()
export class ItineraryGenerationFacade {
  constructor(private readonly aiService: AiService) {}

  async generate(itinerary: Itinerary, userId: number): Promise<LlmJob> {
    const job = await this.aiService.createJob(itinerary, userId);
    return this.aiService.runJob(job.id);
  }
}
