import type { ItineraryGenerationInput } from '../../itinerary-generators';
import type { LlmProvider, JsonObject } from '../../llm/llm-provider';
import type { LlmService } from '../../llm/llm.service';
import type { ItineraryContext } from '../itinerary-prompt';
import { parseCost } from '../itinerary-costs';

/** Executa `fn` para cada item com no maximo `limit` chamadas ao mesmo tempo, preservando a ordem. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

const WEEKDAYS = ['domingo', 'segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sabado'];

export interface TripDate {
  day_number: number;
  date?: string;
  weekday?: string;
}

/** Data e dia da semana de cada dia da viagem; sem `start_date`, so o numero do dia. */
export function tripDates(startDate: string | null | undefined, days: number): TripDate[] {
  const start = startDate ? Date.parse(`${String(startDate).slice(0, 10)}T00:00:00Z`) : NaN;
  return Array.from({ length: days }, (_, index) => {
    if (!Number.isFinite(start)) return { day_number: index + 1 };
    const date = new Date(start + index * 86_400_000);
    return { day_number: index + 1, date: date.toISOString().slice(0, 10), weekday: WEEKDAYS[date.getUTCDay()] };
  });
}

const TRAVELERS: Record<string, number> = { solo: 1, sozinho: 1, couple: 2, casal: 2, family: 4, familia: 4, friends: 3, amigos: 3 };

/** Quantas pessoas viajam (para multiplicar custos por pessoa); sem informacao, 1. */
export const travelersOf = (companionship: string | null | undefined): number => TRAVELERS[(companionship ?? '').toLowerCase()] ?? 1;

/** Prompt com secoes fixas (PAPEL / TAREFA / DADOS / REGRAS / SAIDA). */
export function sectionedPrompt(parts: { role: string; task: string; data: Record<string, unknown>; rules: string[]; output: string; extra?: string }): string {
  const sections = [
    `PAPEL:\n${parts.role}`,
    `TAREFA:\n${parts.task}`,
    `DADOS:\n${JSON.stringify(parts.data)}`,
    `REGRAS:\n${parts.rules.map((rule) => `- ${rule}`).join('\n')}`,
    `SAIDA:\n${parts.output}`,
  ];
  if (parts.extra) sections.push(`TEMPLATE ADICIONAL:\n${parts.extra}`);
  return sections.join('\n\n');
}

/** Tudo que as etapas compartilham. */
export interface PipelineContext {
  input: ItineraryGenerationInput;
  context: ItineraryContext;
  dates: TripDate[];
  currency: string;
  llm: LlmService;
  providers: LlmProvider[];
  /** Orcamento-alvo da viagem toda (0 quando nao ha). */
  budgetTarget: number;
  budgetRange?: { min: number; max: number };
  /** Registra qual provedor/modelo atendeu cada etapa e quanto tempo levou. */
  trace: Record<string, { provider?: string; model?: string; ms: number; ok: boolean; error?: string }>;
}

/** Faixa da viagem manda; sem faixa, usa o budget_total do roteiro (quando > 0). */
export function budgetTargetOf(context: ItineraryContext): { target: number; range?: { min: number; max: number } } {
  const min = context.preferences ? parseCost(context.preferences.budget_min) : 0;
  const max = context.preferences ? parseCost(context.preferences.budget_max) : 0;
  if (min > 0 || max > 0) {
    const target = min > 0 && max > 0 ? (min + max) / 2 : Math.max(min, max);
    return { target, range: { min, max } };
  }
  return { target: parseCost(context.budget_total) };
}

/** Chama o LLM numa etapa, registrando provedor e tempo no trace. */
export async function runStage<T>(
  ctx: PipelineContext,
  stage: string,
  request: { prompt: string; schema: JsonObject; maxOutputTokens?: number; long?: boolean; parse: (payload: JsonObject, attempt: { final: boolean }) => T },
): Promise<T> {
  const started = Date.now();
  try {
    const { value, provider } = await ctx.llm.requestJson(ctx.providers, {
      label: `roteiro ${ctx.input.itinerary.id} / ${stage}`,
      prompt: request.prompt,
      schema: request.schema,
      long: request.long,
      maxOutputTokens: request.maxOutputTokens,
      parse: request.parse,
    });
    ctx.trace[stage] = { provider: provider.key, model: provider.model, ms: Date.now() - started, ok: true };
    return value;
  } catch (error) {
    ctx.trace[stage] = { ms: Date.now() - started, ok: false, error: error instanceof Error ? error.message.slice(0, 200) : String(error) };
    throw error;
  }
}

/** Mesmo que `runStage`, mas so mede tempo de uma etapa local (sem LLM). */
export async function timed<T>(ctx: PipelineContext, stage: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const value = await fn();
    ctx.trace[stage] = { ms: Date.now() - started, ok: true };
    return value;
  } catch (error) {
    ctx.trace[stage] = { ms: Date.now() - started, ok: false, error: error instanceof Error ? error.message.slice(0, 200) : String(error) };
    throw error;
  }
}
