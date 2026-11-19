import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseItineraryGenerator, LlmItineraryGenerator, MockItineraryGenerator } from '../../modules/ai/itinerary-generators';
import { PipelineItineraryGenerator } from '../../modules/ai/itinerary/pipeline/pipeline-generator';
import { FoursquarePlaceProvider } from '../../modules/ai/itinerary/places/foursquare.provider';
import { OsmPlaceProvider } from '../../modules/ai/itinerary/places/osm.provider';
import { PlaceChain, PlaceProvider } from '../../modules/ai/itinerary/places/place-provider';
import { TripadvisorPlaceProvider } from '../../modules/ai/itinerary/places/tripadvisor.provider';
import { LlmService } from '../../modules/ai/llm/llm.service';

const isOff = (value: string | undefined) => ['0', 'false', 'off', 'no'].includes((value ?? '').trim().toLowerCase());

/**
 * Escolhe o gerador pelo DEFAULT_LLM_PROVIDER (paridade com o `get_generator` do Django):
 * `groq`/`gemini`/`deepseek` com chave -> LLM (os outros provedores configurados entram como reserva); sem chave ou `mock` -> mock.
 * Com LLM, ITINERARY_PIPELINE=multi (padrao) usa o pipeline em etapas; `single` usa o prompt unico.
 * ITINERARY_DAY_CONCURRENCY limita quantos dias sao detalhados ao mesmo tempo (padrao 3);
 * ITINERARY_RESEARCH=false desliga a consulta ao Wikivoyage.
 * Lugares (foto, site, nota, faixa de preco): Foursquare e Tripadvisor quando ha chave, OpenStreetMap sempre;
 * ITINERARY_PLACE_LOOKUP=false desliga as buscas (ficam so os links do Google Maps).
 */
@Injectable()
export class ItineraryGeneratorFactory {
  // Uma instancia por processo: o OSM controla o intervalo de 1 req/s entre geracoes simultaneas.
  private readonly osm = new OsmPlaceProvider();

  constructor(private readonly llm: LlmService, private readonly config: ConfigService) {}

  create(): BaseItineraryGenerator {
    const providers = this.llm.itineraryChain();
    if (providers.length === 0) return new MockItineraryGenerator();
    const places = this.placeChain();
    const mode = (this.config.get<string>('ITINERARY_PIPELINE') || 'multi').trim().toLowerCase();
    if (mode === 'single') return new LlmItineraryGenerator(this.llm, providers, places);
    const concurrency = Number(this.config.get<string>('ITINERARY_DAY_CONCURRENCY'));
    return new PipelineItineraryGenerator(this.llm, providers, {
      dayConcurrency: Number.isInteger(concurrency) && concurrency > 0 ? concurrency : 3,
      research: !isOff(this.config.get<string>('ITINERARY_RESEARCH')),
      places,
    });
  }

  /** Cadeia nova por geracao (provedor sem cota sai so daquela geracao). */
  placeChain(): PlaceChain | undefined {
    if (isOff(this.config.get<string>('ITINERARY_PLACE_LOOKUP'))) return undefined;
    const chain: PlaceProvider[] = [];
    const foursquare = (this.config.get<string>('FOURSQUARE_API_KEY') ?? '').trim();
    if (foursquare) chain.push(new FoursquarePlaceProvider(foursquare));
    const tripadvisor = (this.config.get<string>('TRIPADVISOR_API_KEY') ?? '').trim();
    if (tripadvisor) chain.push(new TripadvisorPlaceProvider(tripadvisor));
    chain.push(this.osm);
    return new PlaceChain(chain);
  }
}
