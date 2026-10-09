import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Itinerary } from '../../modules/itineraries/entities';
import { LlmJob } from '../../modules/ai/entities';
import { AiService } from '../../modules/ai/ai.service';

@Injectable()
export class ItineraryGenerationFacade {
  private readonly logger = new Logger(ItineraryGenerationFacade.name);

  constructor(private readonly aiService: AiService) {}

  async generate(itinerary: Itinerary, userId: number): Promise<LlmJob> {
    const job = await this.aiService.createJob(itinerary, userId);
    try {
      return await this.aiService.runJob(job.id);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao gerar o roteiro ${itinerary.id}: ${reason}`, error instanceof Error ? error.stack : undefined);
      await this.aiService.markJobFailed(job.id, itinerary.id, reason);
      throw new InternalServerErrorException('Nao foi possivel gerar o roteiro. Tente novamente.');
    }
  }
}
