import { HttpException, Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Itinerary } from '../../modules/itineraries/entities';
import { LlmJob } from '../../modules/ai/entities';
import { AiService } from '../../modules/ai/ai.service';
import { LlmQuotaError, LlmTimeoutError } from '../../modules/ai/llm/llm.errors';

function generationFailure(error: unknown): HttpException {
  if (error instanceof HttpException && error.getStatus() < 500) return error;
  if (error instanceof LlmQuotaError) {
    return new ServiceUnavailableException('O servico de IA atingiu o limite de uso. Tente novamente em alguns minutos.');
  }
  if (error instanceof LlmTimeoutError) {
    return new ServiceUnavailableException('O servico de IA demorou para responder. Tente novamente.');
  }
  return new InternalServerErrorException('Nao foi possivel gerar o roteiro. Tente novamente.');
}

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
      throw generationFailure(error);
    }
  }
}
