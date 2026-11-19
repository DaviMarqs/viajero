import type { JsonObject } from '../../llm/llm-provider';
import { LlmResponseError } from '../../llm/llm.errors';
import { TripGuide, normalizeTripGuide } from '../itinerary-details';
import { PipelineContext, runStage, sectionedPrompt } from './shared';
import type { TravelSource } from './travel-sources';

const COST = { type: 'string' };

export const GUIDE_SCHEMA: JsonObject = {
  type: 'object',
  properties: {
    overview: { type: 'string' },
    weather: { type: 'string' },
    getting_around: { type: 'string' },
    neighborhoods: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } }, required: ['name'] } },
    money: { type: 'string' },
    safety: { type: 'string' },
    etiquette: { type: 'string' },
    packing: { type: 'array', items: { type: 'string' } },
    phrases: { type: 'array', items: { type: 'string' } },
    local_events: { type: 'array', items: { type: 'string' } },
    documents_health: { type: 'string' },
    cost_benchmarks: {
      type: 'object',
      properties: {
        meal_budget: COST, meal_mid: COST, meal_high: COST, public_transport_ride: COST, taxi_short: COST, hotel_night: COST, attraction_ticket: COST,
      },
    },
  },
  required: ['weather', 'getting_around', 'cost_benchmarks'],
};

export function buildGuidePrompt(ctx: PipelineContext, source: TravelSource | null): string {
  const { context } = ctx;
  const prefs = context.preferences;
  const period = context.start_date ? `${context.start_date} a ${context.end_date ?? '?'}` : prefs?.travel_month || 'nao informado';
  return sectionedPrompt({
    role: 'Voce e um pesquisador de viagens que escreve guias praticos, objetivos e atualizados.',
    task: `Monte o guia pratico de uma viagem de ${context.duration_days} dia(s) para ${context.destination.name} (${context.destination.country}) e uma tabela de custos de referencia em ${ctx.currency}.`,
    data: {
      destino: context.destination,
      periodo: period,
      viajantes: prefs?.companionship ?? null,
      hospedagem: prefs?.hotel_level ?? null,
      transporte: prefs?.transportation_style ?? null,
      interesses: prefs?.interests ?? [],
      dieta: prefs?.dietary_preferences ?? [],
      acessibilidade: prefs?.accessibility_needs ?? [],
      perfil: context.profile ?? null,
      fonte: source ? { url: source.url, secoes: source.sections } : null,
    },
    rules: [
      'Use a FONTE como base quando houver; complete com conhecimento geral confiavel. Nao invente nomes de lugares.',
      'weather: clima esperado NO PERIODO da viagem (temperatura, chuva) e o que isso muda no roteiro.',
      'getting_around: como se locomover (metro, onibus, apps, a pe), com o bilhete/cartao recomendado.',
      'neighborhoods: ate 6 bairros relevantes para o perfil, com 1 frase cada.',
      'money: moeda local, cartao x dinheiro, gorjeta. safety: golpes comuns e areas a evitar a noite.',
      'etiquette: costumes locais. packing: itens para o clima e o perfil. phrases: frases uteis no idioma local com traducao.',
      'local_events: festas ou eventos que costumam acontecer nesse periodo (vazio se nao souber).',
      'documents_health: visto, vacinas, tomada, agua da torneira.',
      `cost_benchmarks: valores realistas de mercado em ${ctx.currency}, formato '123.45', sem simbolo: refeicao economica (meal_budget), media (meal_mid) e alta (meal_high) por pessoa; uma passagem de transporte publico; um taxi/app curto (~5 km); uma diaria de hotel no nivel pedido (hotel_night); um ingresso tipico de atracao.`,
      'Escreva em portugues do Brasil, frases curtas e concretas.',
    ],
    output: 'Um objeto JSON com os campos do schema.',
  });
}

/** Etapa 1a: guia + custos de referencia. Sem fonte externa, o LLM responde so com o que sabe. */
export async function researchGuide(ctx: PipelineContext, source: TravelSource | null): Promise<TripGuide> {
  return runStage(ctx, 'guide', {
    prompt: buildGuidePrompt(ctx, source),
    schema: GUIDE_SCHEMA,
    maxOutputTokens: 3000,
    parse: (payload) => {
      const guide = normalizeTripGuide(payload, source ? [source.url] : []);
      if (!guide) throw new LlmResponseError('o guia veio vazio');
      if (source && guide.cost_benchmarks) guide.cost_benchmarks_source = source.url;
      return guide;
    },
  });
}
