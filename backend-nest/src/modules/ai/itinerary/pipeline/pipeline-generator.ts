import { Logger } from '@nestjs/common';
import {
  BaseItineraryGenerator,
  GeneratedItinerary,
  ItineraryGenerationInput,
  LlmItineraryGenerator,
} from '../../itinerary-generators';
import type { FetchFn, LlmProvider } from '../../llm/llm-provider';
import type { LlmService } from '../../llm/llm.service';
import { formatCost, parseCost } from '../itinerary-costs';
import type { TripGuide } from '../itinerary-details';
import { buildItineraryContext, rankPois } from '../itinerary-prompt';
import { detailDay } from './day-detailer';
import { TripPlan, fallbackPlan, planTrip } from './day-planner';
import { researchGuide } from './guide-research';
import { reviewItinerary } from './itinerary-quality';
import { applyCostSources } from '../cost-sources';
import { enrichPlaces } from '../place-enrichment';
import type { PlaceChain } from '../places/place-provider';
import { PoiInsight, analyzePois } from './poi-analysis';
import { PipelineContext, budgetTargetOf, mapLimit, timed, travelersOf, tripDates } from './shared';
import { TravelSource, fetchTravelSource } from './travel-sources';

export interface PipelineOptions {
  /** Quantos dias sao detalhados em paralelo (rate limit dos provedores). */
  dayConcurrency?: number;
  /** Busca externa (Wikivoyage); false desliga. */
  research?: boolean;
  fetchFn?: FetchFn;
  /** Usado quando o pipeline falha; padrao: o prompt unico. */
  fallback?: BaseItineraryGenerator;
  /** Foto, site, nota e faixa de preco dos lugares; sem cadeia, so os links do Google Maps. */
  places?: PlaceChain;
}

const MAX_POIS = 30;

/**
 * Gera o roteiro em etapas: (1a) guia + custos de referencia com Wikivoyage e (1b) analise dos POIs em paralelo,
 * (2) esqueleto dos dias, (3) cada dia detalhado em paralelo e (4) revisao deterministica.
 * Pesquisa ou analise que falham sao puladas; o planejador tem fallback deterministico; um dia que falha
 * derruba o pipeline e o roteiro sai do prompt unico.
 */
export class PipelineItineraryGenerator extends BaseItineraryGenerator {
  private readonly logger = new Logger(PipelineItineraryGenerator.name);
  private readonly fallback: BaseItineraryGenerator;

  constructor(
    private readonly llm: LlmService,
    private readonly providers: LlmProvider[],
    private readonly options: PipelineOptions = {},
  ) {
    super();
    this.fallback = options.fallback ?? new LlmItineraryGenerator(llm, providers, options.places);
  }

  async generate(input: ItineraryGenerationInput): Promise<GeneratedItinerary> {
    const started = Date.now();
    try {
      return await this.runPipeline(input, started);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`roteiro ${input.itinerary.id}: pipeline falhou (${reason}); usando o prompt unico.`);
      const result = await this.fallback.generate(input);
      result.metadata = { ...result.metadata, pipeline: 'single', pipeline_error: reason.slice(0, 300) };
      return result;
    }
  }

  private async runPipeline(input: ItineraryGenerationInput, started: number): Promise<GeneratedItinerary> {
    const context = buildItineraryContext(input.itinerary, input.profile, input.preferences, input.pois);
    const { target, range } = budgetTargetOf(context);
    const ctx: PipelineContext = {
      input,
      context,
      dates: tripDates(context.start_date, context.duration_days),
      currency: context.preferences?.currency_code || context.currency_code,
      llm: this.llm,
      providers: this.providers,
      budgetTarget: target,
      budgetRange: range,
      trace: {},
    };
    const pois = rankPois(input.pois, MAX_POIS);
    const validPoiIds = new Set(input.pois.map((poi) => Number(poi.id)));
    const fallbackTitle = input.itinerary.title || `Roteiro ${input.itinerary.destination.name}`;

    // Etapas 1a e 1b em paralelo; falha em qualquer uma so tira aquela informacao.
    const [{ guide, source }, insights] = await Promise.all([
      this.research(ctx),
      analyzePois(ctx, pois).catch(() => new Map<number, PoiInsight>()),
    ]);

    // Etapa 2: esqueleto (com fallback deterministico).
    const nightlyReference = parseCost(guide?.cost_benchmarks?.hotel_night);
    let plan: TripPlan;
    let plannerFallback = false;
    try {
      plan = await planTrip(ctx, pois, insights, guide, fallbackTitle);
    } catch {
      plannerFallback = true;
      plan = fallbackPlan(ctx, pois, insights, fallbackTitle, nightlyReference);
    }
    if (plan.lodging && plan.lodging.nightly_cost <= 0 && nightlyReference > 0) plan.lodging.nightly_cost = nightlyReference;

    // Etapa 3: dias em paralelo, com limite.
    const poisById = new Map(input.pois.map((poi) => [Number(poi.id), poi]));
    const duration = context.duration_days;
    const dayBudget = target > 0 ? target / duration : 0;
    const days = await mapLimit(plan.days, this.options.dayConcurrency ?? 3, (day) =>
      detailDay(ctx, {
        plan,
        day,
        pois: day.poi_ids.map((id) => poisById.get(id)).filter((poi): poi is NonNullable<typeof poi> => !!poi),
        insights,
        guide,
        otherThemes: plan.days.filter((other) => other.day_number !== day.day_number).map((other) => other.theme),
        hasNight: duration === 1 || day.day_number < duration,
        dayBudget,
        validPoiIds,
      }),
    );

    const result: GeneratedItinerary = {
      title: plan.title,
      summary: plan.summary || guide?.overview || '',
      currency_code: ctx.currency,
      estimated_cost: formatCost(days.reduce((sum, day) => sum + day.events.reduce((daySum, event) => daySum + parseCost(event.estimated_cost), 0), 0)),
      days,
      guide,
      metadata: {},
    };

    // Etapa 4: revisao (o applyBudgetPrecision roda depois, no AiService, para todos os geradores).
    const quality = reviewItinerary(result, { pace: context.profile?.pace, insights });

    // Etapa 5: de onde vem cada valor e links/fotos dos lugares.
    applyCostSources(result, {
      benchmarks: guide?.cost_benchmarks,
      benchmarksSource: guide?.cost_benchmarks_source,
      ticketByPoi: new Map([...insights.entries()].map(([id, insight]) => [id, insight.ticket_cost])),
      nightlyCost: plan.lodging?.nightly_cost,
      travelers: travelersOf(context.preferences?.companionship),
    });
    const places = await timed(ctx, 'places', () =>
      enrichPlaces(result, { pois: input.pois, destination: input.itinerary.destination, places: this.options.places }),
    );
    quality.warnings.push(...places.warnings);
    const primary = Object.values(ctx.trace).find((entry) => entry.provider);
    result.metadata = {
      pipeline: 'multi',
      generator: primary?.provider ?? 'pipeline',
      model: primary?.model ?? null,
      template_key: input.promptTemplate?.key ?? null,
      poi_count: pois.length,
      stages: {
        guide: !!guide,
        source: source?.url ?? null,
        poi_analysis: insights.size,
        planner: plannerFallback ? 'fallback' : 'llm',
        days: days.length,
        places: { looked_up: places.looked_up, found: places.found, images: places.images, websites: places.websites, providers: places.providers },
      },
      trace: ctx.trace,
      quality,
      elapsed_ms: Date.now() - started,
    };
    return result;
  }

  /** Etapa 1a: fonte externa + guia. Qualquer falha devolve guia vazio. */
  private async research(ctx: PipelineContext): Promise<{ guide?: TripGuide; source: TravelSource | null }> {
    let source: TravelSource | null = null;
    if (this.options.research !== false) {
      const destination = ctx.context.destination;
      source = await timed(ctx, 'source', () => fetchTravelSource([destination.name, destination.city], this.options.fetchFn ?? fetch)).catch(() => null);
    }
    try {
      return { guide: await researchGuide(ctx, source), source };
    } catch {
      return { guide: undefined, source };
    }
  }
}
