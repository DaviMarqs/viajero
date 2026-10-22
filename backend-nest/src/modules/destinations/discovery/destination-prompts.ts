import type { TravelerDnaProfile, UserTripPreference } from '../../profiles/entities';
import type { JsonObject } from '../../ai/llm/llm-provider';
import { LlmResponseError } from '../../ai/llm/llm.errors';

export const VALID_POI_TYPES = ['activity', 'attraction', 'lodging', 'restaurant'];

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.trim() : '').slice(0, max);

// ---------------------------------------------------------------------------
// Resolver: normaliza a busca livre para um lugar real antes de descobrir.
// ---------------------------------------------------------------------------

export const MIN_RESOLVER_CONFIDENCE = 0.5;

export const RESOLVER_SCHEMA: JsonObject = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    country: { type: 'string' },
    city: { type: 'string' },
    region: { type: 'string' },
    is_place: { type: 'boolean' },
    confidence: { type: 'number' },
  },
  required: ['name', 'is_place', 'confidence'],
};

export function resolverPrompt(query: string): string {
  return (
    `Voce normaliza buscas de destino de viagem. O usuario digitou: '${query}'.\n` +
    'Identifique o LUGAR REAL e mais provavel que ele quis dizer e devolva JSON.\n' +
    "- 'name': nome canonico do lugar.\n" +
    "- 'country': pais real do lugar. NAO assuma Brasil; use o pais correto (ex.: 'Tokyo' -> Japao, nao Brasil).\n" +
    "- 'city' e 'region': cidade e estado/regiao quando aplicavel (ex.: 'Formiga' -> cidade Formiga, regiao Minas Gerais, Brasil).\n" +
    "- 'is_place': true apenas se for um destino de viagem real (cidade, regiao, pais, ponto turistico). " +
    "false se for um objeto, animal, marca ou texto sem sentido (ex.: 'formiga' o inseto, 'asdfgh').\n" +
    "- 'confidence': 0 a 1, quao seguro voce esta da identificacao.\n" +
    'Se houver ambiguidade, escolha o destino de viagem mais conhecido.'
  );
}

export interface ResolvedDestination {
  name: string;
  country: string;
  city: string;
  region: string;
  isPlace: boolean;
  confidence: number;
}

export function parseResolvedDestination(payload: JsonObject): ResolvedDestination {
  const confidence = Number(payload.confidence);
  return {
    name: str(payload.name, 150),
    country: str(payload.country, 100),
    city: str(payload.city, 100),
    region: str(payload.region, 100),
    isPlace: payload.is_place === true || payload.is_place === 'true',
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
  };
}

export const isValidPlace = (resolved: ResolvedDestination) => resolved.isPlace && resolved.confidence >= MIN_RESOLVER_CONFIDENCE;

// ---------------------------------------------------------------------------
// Enricher: dados factuais do destino (resumo, epoca, fuso, POIs) vindos do LLM.
// ---------------------------------------------------------------------------

export const ENRICHMENT_SCHEMA: JsonObject = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    country: { type: 'string' },
    city: { type: 'string' },
    summary: { type: 'string' },
    best_season: { type: 'string' },
    timezone: { type: 'string' },
    pois: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: VALID_POI_TYPES },
          summary: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'type'],
      },
    },
  },
};

export function enrichmentPrompt(query: string, country: string, city: string): string {
  return (
    `Voce e uma fonte de dados de viagem. Para o destino '${query}' ` +
    `(pais: ${country || '(nao informado)'}, cidade: ${city || '(nao informado)'}), devolva JSON estruturado conforme o schema. ` +
    'Foque em informacao factual e atemporal, escrita em portugues do Brasil. ' +
    "Para 'summary' use 2 a 3 paragrafos curtos. " +
    "Para 'best_season' indique a melhor epoca para visitar em poucas palavras. " +
    "Para 'timezone' use o identificador IANA (ex.: America/Sao_Paulo). " +
    "Para 'pois' liste ate 10 pontos REAIS e conhecidos, sem inventar URLs. " +
    "'type' deve ser exatamente um destes valores: attraction, restaurant, activity, lodging. " +
    "Em 'tags' prefira estas palavras: cultura, historia, gastronomia, natureza, praia, noturno, compras, familia, aventura. " +
    'Se nao tiver certeza de algum campo, deixe vazio (string vazia ou array vazio).'
  );
}

export interface EnrichedPoi {
  name: string;
  type: string;
  summary: string;
  tags: string[];
  source: string;
}

export interface EnrichmentResult {
  name: string;
  country: string;
  city: string;
  summary: string;
  best_season: string;
  timezone: string;
  pois: EnrichedPoi[];
  source: string;
  model: string;
}

export const emptyEnrichment = (): EnrichmentResult => ({
  name: '', country: '', city: '', summary: '', best_season: '', timezone: '', pois: [], source: '', model: '',
});

export const hasMeaningfulEnrichment = (result: EnrichmentResult) => Boolean(result.summary) || result.pois.length > 0;

export function sanitizeEnrichedPois(raw: unknown, source: string): EnrichedPoi[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const poi = item as Record<string, unknown>;
    const name = str(poi.name, 160);
    const rawType = str(poi.type, 40).toLowerCase();
    if (!name || !rawType) return [];
    const tags = Array.isArray(poi.tags) ? poi.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0).map((tag) => tag.trim()) : [];
    return [{ name, type: VALID_POI_TYPES.includes(rawType) ? rawType : 'activity', summary: str(poi.summary, 4000), tags, source }];
  });
}

export function parseEnrichment(payload: JsonObject, source: string, model: string): EnrichmentResult {
  return {
    name: str(payload.name, 150),
    country: str(payload.country, 100),
    city: str(payload.city, 100),
    summary: str(payload.summary, 4000),
    best_season: str(payload.best_season, 120),
    timezone: str(payload.timezone, 64),
    pois: sanitizeEnrichedPois(payload.pois, source),
    source,
    model,
  };
}

// ---------------------------------------------------------------------------
// Sugestao: o LLM escolhe um destino a partir do DNA e das preferencias.
// ---------------------------------------------------------------------------

export const SUGGESTION_SCHEMA: JsonObject = {
  type: 'object',
  properties: {
    destination_name: { type: 'string' },
    country: { type: 'string' },
    city: { type: 'string' },
    rationale: { type: 'string' },
  },
  required: ['destination_name'],
};

export interface DestinationSuggestion {
  name: string;
  country: string;
  city: string;
  rationale: string;
}

export function suggestionPrompt(
  profile: TravelerDnaProfile | null,
  preferences: UserTripPreference | null,
  alreadyUsed: string[],
): string {
  const traits: string[] = [];
  if (profile) {
    traits.push(`estilo de viagem: ${profile.travel_style}`);
    traits.push(`ritmo: ${profile.pace}`);
    traits.push(`nivel de conforto: ${profile.comfort_level}`);
    traits.push(
      'interesses (0-10): ' +
        `aventura ${profile.adventure_level}, gastronomia ${profile.food_focus}, cultura ${profile.cultural_interest}, ` +
        `natureza ${profile.nature_interest}, vida noturna ${profile.nightlife_interest}`,
    );
  }
  if (preferences) {
    traits.push(`orcamento entre ${preferences.budget_min} e ${preferences.budget_max} ${preferences.currency_code}`);
    if (preferences.companionship) traits.push(`companhia: ${preferences.companionship}`);
    if (preferences.travel_month) traits.push(`mes pretendido: ${preferences.travel_month}`);
    if (preferences.preferred_trip_length_days) traits.push(`duracao: ${preferences.preferred_trip_length_days} dias`);
    if (preferences.interests?.length) traits.push(`interesses declarados: ${preferences.interests.join(', ')}`);
    if (preferences.hotel_level) traits.push(`hospedagem: ${preferences.hotel_level}`);
  }
  const avoid = alreadyUsed.length
    ? `\n\nO usuario ja tem roteiro para estes destinos, entao NAO os escolha de novo; sugira um destino DIFERENTE: ${alreadyUsed.join(', ')}.`
    : '';
  return (
    'Voce e um consultor de viagens. Escolha UM unico destino real e conhecido que combine com o perfil do viajante abaixo. ' +
    "PRIORIZE destinos no Brasil: salvo se o perfil pedir claramente uma viagem internacional, o destino deve ser brasileiro (country='Brasil'). " +
    'Considere o orcamento e a epoca quando informados. ' +
    'Devolva o nome do destino, pais e cidade (quando aplicavel) e uma justificativa curta em portugues.\n\n' +
    `Perfil do viajante: ${traits.length ? traits.join('; ') : 'perfil ainda nao informado'}.${avoid}`
  );
}

export function parseSuggestion(payload: JsonObject): DestinationSuggestion {
  const suggestion = {
    name: str(payload.destination_name, 150),
    country: str(payload.country, 100),
    city: str(payload.city, 100),
    rationale: str(payload.rationale, 500),
  };
  if (!suggestion.name) throw new LlmResponseError('Sugestao sem nome de destino.');
  return suggestion;
}
