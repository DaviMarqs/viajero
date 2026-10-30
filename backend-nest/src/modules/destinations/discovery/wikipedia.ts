import { Logger } from '@nestjs/common';
import { cleanImageUrl } from './slug';

const TIMEOUT_MS = 6000;
const LANGUAGES = ['pt', 'en'];
const HEADERS = { 'User-Agent': 'Viajero/1.0 (https://github.com/DaviMarqs/viajero) node-fetch', Accept: 'application/json' };
const PLACE_WORDS =
  /munic[ií]pio|cidade|capital|vila|distrito|regi[aã]o|estado|pa[ií]s|ilha|praia|bairro|arquip[eé]lago|parque nacional|\b(city|town|village|municipality|region|province|island|country|state|archipelago|national park)\b/i;
const logger = new Logger('WikipediaThumbnail');

interface PageSummary {
  type?: string;
  description?: string;
  extract?: string;
  originalimage?: { source?: unknown };
  thumbnail?: { source?: unknown };
}

/** Miniaturas da Wikimedia acima de 1280px pesam varios MB; 1280 e um tamanho padrao do servidor deles. */
export function limitWikimediaWidth(url: string): string {
  return url.replace(/\/(\d+)px-([^/?#]+)(?=[?#]|$)/, (match, width: string, name: string) => (Number(width) > 1280 ? `/1280px-${name}` : match));
}

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A pagina pelo nome puro precisa descrever um lugar (evita "Formiga" inseto, "Tiradentes" pessoa):
 * a descricao curta tem palavra de lugar e, com dicas, cita a regiao ou o pais como palavra inteira.
 */
export function looksLikePlace(page: PageSummary, hints: string[]): boolean {
  const description = normalize(page.description?.trim() || (page.extract ?? '').slice(0, 300));
  if (!PLACE_WORDS.test(description)) return false;
  const usableHints = hints.map((hint) => normalize(hint.trim())).filter((hint) => hint.length > 2);
  if (usableHints.length === 0) return true;
  const text = `${description} ${normalize((page.extract ?? '').slice(0, 600))}`;
  return usableHints.some((hint) => new RegExp(`\\b${escapeRegExp(hint)}\\b`).test(text));
}

/**
 * Foto publica da Wikipedia (REST API, sem chave). Com `region`, tenta antes o titulo desambiguado
 * "{query} ({region})" (ex.: "Formiga (Minas Gerais)"); o nome puro so vale se a pagina for de um lugar
 * daquela regiao/pais. pt antes de en.
 */
export async function fetchWikipediaThumbnail(
  query: string,
  hints: { region?: string; country?: string } = {},
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const base = query.trim();
  const region = hints.region ?? '';
  if (!base) return '';
  const candidates = region.trim() ? [{ title: `${base} (${region.trim()})`, checkPlace: false }] : [];
  candidates.push({ title: base, checkPlace: true });

  for (const candidate of candidates) {
    const title = encodeURIComponent(candidate.title.replace(/ /g, '_'));
    for (const lang of LANGUAGES) {
      try {
        const response = await fetchFn(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${title}`, {
          headers: HEADERS,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (response.status !== 200) continue;
        const page = (await response.json()) as PageSummary;
        if (page.type === 'disambiguation') continue;
        if (candidate.checkPlace && !looksLikePlace(page, [region, hints.country ?? ''])) continue;
        const source = cleanImageUrl(page.originalimage?.source) || cleanImageUrl(page.thumbnail?.source);
        if (source) return limitWikimediaWidth(source);
      } catch (error) {
        logger.warn(`Wikipedia indisponivel para "${candidate.title}" (${lang}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return '';
}
