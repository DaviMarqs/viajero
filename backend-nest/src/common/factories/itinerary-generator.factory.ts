import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseItineraryGenerator, MockItineraryGenerator } from '../../modules/ai/itinerary-generators';

@Injectable()
export class ItineraryGeneratorFactory {
  constructor(private readonly config: ConfigService) {}

  create(): BaseItineraryGenerator {
    const provider = this.config.get<string>('DEFAULT_LLM_PROVIDER', 'mock');
    if (provider === 'mock') {
      return new MockItineraryGenerator();
    }
    return new MockItineraryGenerator();
  }
}
