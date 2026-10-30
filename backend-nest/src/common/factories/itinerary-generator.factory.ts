import { Injectable } from '@nestjs/common';
import { BaseItineraryGenerator, LlmItineraryGenerator, MockItineraryGenerator } from '../../modules/ai/itinerary-generators';
import { LlmService } from '../../modules/ai/llm/llm.service';

/**
 * Escolhe o gerador pelo DEFAULT_LLM_PROVIDER (paridade com o `get_generator` do Django):
 * `groq`/`gemini` com chave -> LLM (o outro provedor configurado entra como reserva); sem chave ou `mock` -> mock.
 */
@Injectable()
export class ItineraryGeneratorFactory {
  constructor(private readonly llm: LlmService) {}

  create(): BaseItineraryGenerator {
    const providers = this.llm.itineraryChain();
    return providers.length > 0 ? new LlmItineraryGenerator(this.llm, providers) : new MockItineraryGenerator();
  }
}
