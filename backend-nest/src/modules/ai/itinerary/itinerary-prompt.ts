import type { Itinerary } from '../../itineraries/entities';
import type { PointOfInterest } from '../../destinations/entities';
import type { TravelerDnaProfile, UserTripPreference } from '../../profiles/entities';
import type { PromptTemplate } from '../entities';
import type { JsonObject } from '../llm/llm-provider';
import { parseCost } from './itinerary-costs';

export const ITINERARY_SCHEMA: JsonObject = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    estimated_cost: { type: 'string' },
    currency_code: { type: 'string' },
    days: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          events: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                poi_id: { type: ['integer', 'null'] },
                title: { type: 'string' },
                description: { type: 'string' },
                start_time: { type: 'string' },
                end_time: { type: 'string' },
                estimated_cost: { type: 'string' },
                order_index: { type: 'integer' },
              },
              required: ['title', 'description', 'order_index'],
            },
          },
        },
        required: ['title', 'events'],
      },
    },
  },
  required: ['title', 'days'],
};

const COMPANIONSHIP: Record<string, string> = { solo: 'sozinho', couple: 'casal', family: 'familia', friends: 'amigos' };
const HOTEL_LEVEL: Record<string, string> = { budget: 'economica', mid: 'intermediaria', luxury: 'luxo' };
const TRANSPORTATION: Record<string, string> = { public: 'transporte publico', mixed: 'misto (publico e privado)', private: 'carro ou transfer privado' };
const INTERESTS: Record<string, string> = {
  food: 'gastronomia', culture: 'cultura', nature: 'natureza', nightlife: 'vida noturna',
  wellness: 'relaxamento', shopping: 'compras', adventure: 'aventura',
};
const DIETARY: Record<string, string> = { vegetarian: 'vegetariana', vegan: 'vegana', gluten_free: 'sem gluten', lactose_free: 'sem lactose' };
const ACCESSIBILITY: Record<string, string> = { mobility: 'mobilidade reduzida', hearing: 'apoio auditivo', visual: 'apoio visual' };

const translate = (values: string[] | null | undefined, labels: Record<string, string>) => (values ?? []).map((value) => labels[value] ?? value);
const MAX_POIS_IN_PROMPT = 30;

export type TripParameters = Pick<
  UserTripPreference,
  | 'budget_min' | 'budget_max' | 'currency_code' | 'companionship' | 'preferred_trip_length_days' | 'travel_month'
  | 'hotel_level' | 'transportation_style' | 'dietary_preferences' | 'accessibility_needs' | 'interests' | 'metadata'
>;

export interface ItineraryContext {
  destination: { id: number; name: string; country: string; city: string; summary: string; best_season?: string };
  duration_days: number;
  currency_code: string;
  budget_total?: string;
  start_date?: string | null;
  end_date?: string | null;
  pois: Array<{ id: number; name: string; type: string; rating: string; visit_minutes: number }>;
  profile?: Record<string, unknown>;
  preferences?: {
    budget_min: string; budget_max: string; currency_code: string; preferred_trip_length_days: number;
    companionship: string | null; travel_month: string | null; hotel_level: string | null; transportation_style: string | null;
    dietary_preferences: string[]; accessibility_needs: string[]; interests: string[];
  };
}

export function buildItineraryContext(
  itinerary: Itinerary,
  profile: TravelerDnaProfile | null,
  preferences: TripParameters | null,
  pois: PointOfInterest[],
): ItineraryContext {
  const ranked = [...pois]
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || a.name.localeCompare(b.name))
    .slice(0, MAX_POIS_IN_PROMPT);
  const context: ItineraryContext = {
    destination: {
      id: Number(itinerary.destination.id),
      name: itinerary.destination.name,
      country: itinerary.destination.country,
      city: itinerary.destination.city ?? '',
      summary: (itinerary.destination.summary ?? '').slice(0, 500),
      ...(itinerary.destination.best_season ? { best_season: itinerary.destination.best_season } : {}),
    },
    duration_days: itinerary.duration_days,
    currency_code: itinerary.currency_code,
    budget_total: String(itinerary.budget_total ?? '0'),
    start_date: itinerary.start_date ?? null,
    end_date: itinerary.end_date ?? null,
    pois: ranked.map((poi) => ({
      id: Number(poi.id),
      name: poi.name,
      type: poi.poi_type,
      rating: String(poi.rating ?? '0'),
      visit_minutes: poi.estimated_visit_minutes || 90,
    })),
  };
  if (profile) {
    context.profile = {
      travel_style: profile.travel_style,
      pace: profile.pace,
      comfort_level: profile.comfort_level,
      interesses_0_a_10: {
        aventura: profile.adventure_level,
        gastronomia: profile.food_focus,
        cultura: profile.cultural_interest,
        natureza: profile.nature_interest,
        vida_noturna: profile.nightlife_interest,
        energia_social: profile.social_energy,
      },
    };
  }
  if (preferences) {
    context.preferences = {
      budget_min: String(preferences.budget_min),
      budget_max: String(preferences.budget_max),
      currency_code: preferences.currency_code,
      preferred_trip_length_days: preferences.preferred_trip_length_days,
      companionship: COMPANIONSHIP[preferences.companionship] ?? (preferences.companionship || null),
      travel_month: preferences.travel_month || null,
      hotel_level: HOTEL_LEVEL[preferences.hotel_level] ?? (preferences.hotel_level || null),
      transportation_style: TRANSPORTATION[preferences.transportation_style] ?? (preferences.transportation_style || null),
      dietary_preferences: translate(preferences.dietary_preferences, DIETARY),
      accessibility_needs: translate(preferences.accessibility_needs, ACCESSIBILITY),
      interests: translate(preferences.interests, INTERESTS),
    };
  }
  return context;
}

export function buildItineraryPrompt(context: ItineraryContext, template: Pick<PromptTemplate, 'template'> | null): string {
  const currency = context.currency_code;
  // Ancoras de orcamento so entram quando ha valor real (> 0): "0.00" faz o LLM zerar todos os custos.
  const budgetTotal = parseCost(context.budget_total);
  const prefs = context.preferences;
  const budgetMin = prefs ? parseCost(prefs.budget_min) : 0;
  const budgetMax = prefs ? parseCost(prefs.budget_max) : 0;

  // Com faixa da viagem, ela manda: o budget_total do roteiro pode ser o custo da geracao anterior
  // e ancoraria a regeneracao no resultado antigo.
  const hasRange = budgetMin > 0 || budgetMax > 0;
  const useBudgetTotal = budgetTotal > 0 && !hasRange;
  let prefsHint = '';
  let budgetRule = '';
  if (prefs) {
    prefsHint =
      (hasRange ? ` Orcamento entre ${prefs.budget_min} e ${prefs.budget_max} ${prefs.currency_code}.` : '') +
      ` Interesses: ${prefs.interests.join(', ') || 'nao informados'}.` +
      ` Estilo de hospedagem: ${prefs.hotel_level || 'nao informado'}.` +
      ` Restricoes alimentares: ${prefs.dietary_preferences.join(', ') || 'nenhuma'}.` +
      (prefs.companionship ? ` Viaja: ${prefs.companionship}.` : '') +
      (prefs.transportation_style ? ` Transporte preferido: ${prefs.transportation_style}.` : '') +
      (prefs.accessibility_needs.length ? ` Necessidades de acessibilidade: ${prefs.accessibility_needs.join(', ')} (escolha atividades compativeis).` : '');
    if (hasRange) {
      budgetRule =
        ` REGRA DE ORCAMENTO: a soma de TODOS os estimated_cost deve ficar OBRIGATORIAMENTE entre ` +
        `${prefs.budget_min} e ${prefs.budget_max} ${prefs.currency_code}.`;
    }
  }
  if (!budgetRule && useBudgetTotal) {
    budgetRule = ` O CUSTO TOTAL (soma de todos os eventos) deve ficar proximo de ${context.budget_total} ${currency}.`;
  }

  const period =
    context.start_date && context.end_date
      ? ` A viagem vai de ${context.start_date} a ${context.end_date}.`
      : prefs?.travel_month
        ? ` Mes da viagem: ${prefs.travel_month}.`
        : '';

  let intro =
    'Voce e um planejador de viagens. ' +
    `Crie um roteiro de EXATAMENTE ${context.duration_days} dias para ${context.destination.name} (${context.destination.country}).` +
    (useBudgetTotal ? ` Orcamento total: ${context.budget_total} ${currency}.` : '') +
    period +
    prefsHint +
    " Prefira eventos que referenciem POIs existentes via 'poi_id'. " +
    'Inclua tambem eventos de hospedagem (por dia), refeicoes e transporte com poi_id=null para que o custo seja realista. ' +
    'Cada dia deve ter entre 3 e 6 eventos.' +
    budgetRule +
    " REGRAS DE VALOR: cada 'estimated_cost' (de cada evento e do roteiro) " +
    `deve ser um numero decimal em ${currency}, no formato '1234.56', ` +
    'SEM simbolo de moeda, SEM separador de milhar e SEM texto. ' +
    'Use estimativas realistas de mercado para o destino.' +
    " REGRAS DE HORARIO: cada evento tem 'start_time' e 'end_time' no formato HH:MM (24h), em ordem cronologica, " +
    'sem sobreposicao dentro do dia e respeitando o ritmo do viajante.' +
    ' IDIOMA: escreva title, summary e description em portugues do Brasil. ' +
    "O 'title' de cada dia deve ser curto e descrever o tema do dia, sem repetir 'Dia N'.";
  if (template?.template) intro = `${intro}\n\nTemplate adicional:\n${template.template}`;

  // Mesmos motivos: "budget_total": "0.00" ancora custos zerados e o custo antigo ancora a regeneracao.
  const contextForPrompt: Partial<ItineraryContext> = { ...context };
  if (!useBudgetTotal) delete contextForPrompt.budget_total;
  return `${intro}\n\nContexto:\n${JSON.stringify(contextForPrompt)}`;
}
