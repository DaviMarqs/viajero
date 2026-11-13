import { Logger } from '@nestjs/common';
import { cleanImageUrl } from './slug';

const TIMEOUT_MS = 6000;
const LANGUAGES = ['pt', 'en'];
const HEADERS = { 'User-Agent': 'Viajero/1.0 (https://github.com/DaviMarqs/viajero) node-fetch', Accept: 'application/json' };
const PLACE_WORDS =
  /munic[ií]pio|cidade|capital|comuna|comune|commune|metr[oó]pole|vila|distrito|regi[aã]o|estado|pa[ií]s|ilha|praia|bairro|arquip[eé]lago|parque nacional|\b(city|town|village|municipality|region|province|island|country|state|archipelago|national park)\b/i;
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
  // O pais vem em portugues ("Italia") e a Wikipedia em ingles ("Italy"): alem da palavra inteira, vale o mesmo radical de 4 letras.
  return usableHints.some((hint) => {
    const stem = hint.length >= 5 ? `|${escapeRegExp(hint.slice(0, 4))}` : '';
    return new RegExp(`\\b(?:${escapeRegExp(hint)}${stem})`).test(text);
  });
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
        // A imagem de destaque do artigo pode ser bandeira/mapa (svg, descartado): a versao em ingles costuma ter foto.
        if (lang !== 'en') {
          const english = await englishCounterpartImage(lang, candidate.title, fetchFn);
          if (english) return english;
        }
      } catch (error) {
        logger.warn(`Wikipedia indisponivel para "${candidate.title}" (${lang}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return '';
}

/** Mesmo artigo na Wikipedia em ingles (via langlinks): ex. "Viena" (pt, so bandeira) -> "Vienna". */
async function englishCounterpartImage(lang: string, title: string, fetchFn: typeof fetch): Promise<string> {
  try {
    const links = await fetchFn(
      `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=langlinks&lllang=en&redirects=1&format=json&formatversion=2`,
      { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (links.status !== 200) return '';
    const body = (await links.json()) as { query?: { pages?: Array<{ langlinks?: Array<{ title?: string }> }> } };
    const englishTitle = body.query?.pages?.[0]?.langlinks?.[0]?.title;
    if (!englishTitle) return '';
    const response = await fetchFn(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(englishTitle.replace(/ /g, '_'))}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status !== 200) return '';
    const page = (await response.json()) as PageSummary;
    if (page.type === 'disambiguation') return '';
    const source = cleanImageUrl(page.originalimage?.source) || cleanImageUrl(page.thumbnail?.source);
    return source ? limitWikimediaWidth(source) : '';
  } catch (error) {
    logger.warn(`Wikipedia (en) indisponivel para "${title}": ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}
