import { TtlCache } from '../../../destinations/discovery/ttl-cache';
import type { FetchFn } from '../../llm/llm-provider';

/**
 * Fonte externa do guia: Wikivoyage (pt e depois en). So o NOME DO DESTINO sai daqui; nenhum dado do usuario.
 * Pega a introducao e as secoes uteis (clima, locomocao, comida, seguranca, respeito), cortadas.
 */

export interface TravelSource {
  url: string;
  lang: string;
  title: string;
  /** Secoes escolhidas: titulo -> texto (ja cortado). */
  sections: Record<string, string>;
}

const SECTION_CHARS = 1500;
const TOTAL_CHARS = 6000;
const HIT_TTL_MS = 6 * 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 8000;
const USER_AGENT = 'TravelItineraryBot/1.0 (itinerary research; contact via project repository)';

const WANTED: Record<string, string[]> = {
  pt: ['entenda', 'clima', 'circular', 'como circular', 'chegar', 'comer', 'coma', 'beber', 'segurança', 'seguranca', 'fique seguro', 'respeito', 'dormir', 'durma', 'cuide-se', 'saúde', 'saude', 'eventos', 'festas'],
  en: ['understand', 'climate', 'get around', 'get in', 'eat', 'drink', 'stay safe', 'stay healthy', 'respect', 'sleep', 'cope', 'events', 'festivals'],
};

const sharedCache = new TtlCache<TravelSource | null>();

const clean = (value: string) => value.replace(/\n{3,}/g, '\n\n').trim();
const normalizeHeading = (value: string) => value.trim().toLowerCase();

/** Separa o texto plano do Wikivoyage ("== Titulo ==") e escolhe as secoes uteis. */
export function selectSections(extract: string, lang: string): Record<string, string> {
  const wanted = WANTED[lang] ?? WANTED.en;
  const parts = extract.split(/\n(={2,3})\s*([^=\n]+?)\s*\1\n/);
  const sections: Record<string, string> = {};
  let total = 0;
  const add = (title: string, body: string) => {
    const textBody = clean(body).slice(0, SECTION_CHARS);
    if (!textBody || total >= TOTAL_CHARS) return;
    const room = TOTAL_CHARS - total;
    const finalText = textBody.slice(0, room);
    sections[title] = sections[title] ? `${sections[title]}\n${finalText}` : finalText;
    total += finalText.length;
  };
  add('intro', parts[0] ?? '');
  for (let index = 1; index + 1 < parts.length; index += 3) {
    const heading = parts[index + 1];
    const body = parts[index + 2] ?? '';
    if (!heading) continue;
    const key = normalizeHeading(heading);
    if (wanted.some((item) => key.startsWith(item))) add(heading.trim(), body);
  }
  return sections;
}

async function fetchExtract(fetchFn: FetchFn, lang: string, title: string): Promise<TravelSource | null> {
  const params = new URLSearchParams({
    action: 'query', prop: 'extracts', explaintext: '1', redirects: '1', format: 'json', formatversion: '2', titles: title,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchFn(`https://${lang}.wikivoyage.org/w/api.php?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { query?: { pages?: Array<{ title?: string; extract?: string; missing?: boolean }> | Record<string, { title?: string; extract?: string; missing?: unknown }> } };
    const rawPages = body.query?.pages;
    const pages = Array.isArray(rawPages) ? rawPages : Object.values(rawPages ?? {});
    const page = pages.find((item) => !item.missing && typeof item.extract === 'string' && item.extract.trim().length > 200);
    if (!page?.extract) return null;
    const sections = selectSections(page.extract, lang);
    if (Object.keys(sections).length === 0) return null;
    const pageTitle = page.title ?? title;
    return { url: `https://${lang}.wikivoyage.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`, lang, title: pageTitle, sections };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Busca o destino no Wikivoyage pt e depois en (tentando tambem a cidade). Falhas viram null e ficam em cache por 1 h. */
export async function fetchTravelSource(
  names: string[],
  fetchFn: FetchFn = fetch,
  cache: TtlCache<TravelSource | null> = sharedCache,
): Promise<TravelSource | null> {
  const titles = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (titles.length === 0) return null;
  const key = titles.join('|').toLowerCase();
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  for (const lang of ['pt', 'en']) {
    for (const title of titles) {
      const source = await fetchExtract(fetchFn, lang, title);
      if (source) {
        cache.set(key, source, HIT_TTL_MS);
        return source;
      }
    }
  }
  cache.set(key, null, MISS_TTL_MS);
  return null;
}
