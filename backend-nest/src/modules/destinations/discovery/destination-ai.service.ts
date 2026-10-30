import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../ai/llm/llm.service';
import type { TravelerDnaProfile, UserTripPreference } from '../../profiles/entities';
import {
  DestinationSuggestion,
  ENRICHMENT_SCHEMA,
  EnrichmentResult,
  RESOLVER_SCHEMA,
  ResolvedDestination,
  SUGGESTION_SCHEMA,
  emptyEnrichment,
  enrichmentPrompt,
  hasMeaningfulEnrichment,
  parseEnrichment,
  parseResolvedDestination,
  parseSuggestion,
  resolverPrompt,
  suggestionPrompt,
} from './destination-prompts';

/** Chamadas de LLM ligadas a destinos. Todas sao fail-open: sem chave ou com erro, devolvem null/vazio. */
@Injectable()
export class DestinationAiService {
  private readonly logger = new Logger(DestinationAiService.name);

  constructor(private readonly llm: LlmService) {}

  isAvailable(): boolean {
    return this.llm.hasAny();
  }

  /** Normaliza a busca livre ("Formiga", "Tokyo") para um lugar real. Groq primeiro, como no Django. */
  async resolve(query: string): Promise<ResolvedDestination | null> {
    const trimmed = query.trim();
    if (!trimmed) return null;
    try {
      const { value } = await this.llm.requestJson(this.llm.chain(['groq', 'gemini']), {
        label: 'resolver de destino',
        prompt: resolverPrompt(trimmed),
        schema: RESOLVER_SCHEMA,
        parse: parseResolvedDestination,
      });
      return value;
    } catch (error) {
      this.logger.warn(`Resolver de destino indisponivel para "${trimmed}": ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /** Resumo, epoca, fuso e POIs do destino. Gemini primeiro e Groq como reserva, como no Django. */
  async enrich(query: string, country: string, city: string): Promise<EnrichmentResult> {
    const providers = this.llm.chain(['gemini', 'groq']);
    for (const provider of providers) {
      try {
        const { value } = await this.llm.requestJson([provider], {
          label: 'enriquecimento de destino',
          prompt: enrichmentPrompt(query, country, city),
          schema: ENRICHMENT_SCHEMA,
          parse: (payload) => parseEnrichment(payload, provider.key, provider.model),
        });
        if (hasMeaningfulEnrichment(value)) return value;
        this.logger.log(`${provider.key} sem dados uteis para "${query}", tentando o proximo provedor`);
      } catch (error) {
        this.logger.warn(`Enriquecimento via ${provider.key} falhou para "${query}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return emptyEnrichment();
  }

  /** O LLM escolhe um destino pelo perfil, evitando os que o usuario ja tem roteiro. */
  async suggest(profile: TravelerDnaProfile | null, preferences: UserTripPreference | null, alreadyUsed: string[]): Promise<DestinationSuggestion | null> {
    try {
      const { value } = await this.llm.requestJson(this.llm.chain(['groq', 'gemini']), {
        label: 'sugestao de destino',
        prompt: suggestionPrompt(profile, preferences, alreadyUsed),
        schema: SUGGESTION_SCHEMA,
        parse: parseSuggestion,
      });
      return value;
    } catch (error) {
      this.logger.warn(`Sugestao de destino por IA indisponivel: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
