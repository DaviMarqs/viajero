import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { mergeDiscovery, normalizePoiType } from '../destination-discovery.service';
import { emptyEnrichment, isValidPlace, parseEnrichment, parseResolvedDestination, parseSuggestion, suggestionPrompt } from '../destination-prompts';
import { FirecrawlClient, isSupportedUrl, wikipediaFallbackUrl } from '../firecrawl.client';
import { cleanImageUrl, cleanUrl, slugify, titleCase } from '../slug';
import { filterReachableImages, isReachableImage } from '../image-check';
import { fetchWikipediaThumbnail, limitWikimediaWidth, looksLikePlace } from '../wikipedia';
import { LlmResponseError } from '../../../ai/llm/llm.errors';

describe('slug helpers', () => {
  it('slugify segue o Django', () => {
    expect(slugify('São Paulo — Centro!')).toBe('sao-paulo-centro');
    expect(slugify('x'.repeat(60))).toHaveLength(50);
  });
  it('titleCase e cleanUrl', () => {
    expect(titleCase('rio de janeiro')).toBe('Rio De Janeiro');
    expect(cleanUrl(' https://img.test/a.jpg ')).toBe('https://img.test/a.jpg');
    expect(cleanUrl('javascript:alert(1)')).toBe('');
  });
  it('cleanImageUrl descarta icones, svg e miniaturas', () => {
    expect(cleanImageUrl('https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Disambig_grey.svg/40px-Disambig_grey.svg.png?utm=x')).toBe('');
    expect(cleanImageUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/Ouro.jpg/120px-Ouro.jpg')).toBe('');
    expect(cleanImageUrl('https://site.test/assets/logo.png')).toBe('');
    expect(cleanImageUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/Ouro.jpg/1280px-Ouro.jpg')).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/Ouro.jpg/1280px-Ouro.jpg');
    expect(cleanImageUrl('https://images.test/ouro-preto.jpg')).toBe('https://images.test/ouro-preto.jpg');
  });
});

describe('resolver', () => {
  it('aceita lugar com confianca e recusa nao-lugar', () => {
    const place = parseResolvedDestination({ name: 'Formiga', country: 'Brasil', region: 'Minas Gerais', is_place: true, confidence: 0.9 });
    expect(isValidPlace(place)).toBe(true);
    expect(isValidPlace(parseResolvedDestination({ name: 'formiga', is_place: false, confidence: 0.95 }))).toBe(false);
    expect(isValidPlace(parseResolvedDestination({ name: 'X', is_place: true, confidence: 'muito' }))).toBe(false);
    expect(parseResolvedDestination({ name: 'Y', is_place: true, confidence: 7 }).confidence).toBe(1);
  });
});

describe('enricher', () => {
  it('sanitiza POIs: tipo desconhecido vira activity e sem tipo e descartado', () => {
    const result = parseEnrichment(
      { name: 'Ouro Preto', summary: 'Cidade historica', pois: [{ name: 'Museu', type: 'Museum', tags: ['historia', 2, ' '] }, { name: 'Sem tipo' }, 'lixo'] },
      'groq',
      'llama',
    );
    expect(result.pois).toEqual([{ name: 'Museu', type: 'activity', summary: '', tags: ['historia'], source: 'groq' }]);
  });
});

describe('sugestao', () => {
  it('inclui cuidados, transporte e datas específicos da viagem no prompt', () => {
    const prompt = suggestionPrompt(null, {
      budget_min: '1000', budget_max: '3000', currency_code: 'BRL',
      transportation_style: 'public', dietary_preferences: ['vegan'],
      accessibility_needs: ['mobility'], metadata: { start_date: '2027-01-10', end_date: '2027-01-15' },
    } as never, []);
    for (const value of ['public', 'vegan', 'mobility', '2027-01-10', '2027-01-15']) expect(prompt).toContain(value);
  });
  it('evita destinos que o usuario ja usou e exige nome', () => {
    expect(suggestionPrompt(null, null, ['Lisbon'])).toContain('sugira um destino DIFERENTE: Lisbon.');
    expect(() => parseSuggestion({ destination_name: ' ' })).toThrow(LlmResponseError);
  });
});

describe('mergeDiscovery', () => {
  const llm = { ...emptyEnrichment(), name: 'Lisboa', country: 'Portugal', summary: 'Resumo do LLM', best_season: 'Primavera', source: 'gemini', model: 'g', pois: [
    { name: 'Torre de Belém', type: 'attraction', summary: '', tags: [], source: 'gemini' },
    { name: 'Alfama', type: 'activity', summary: '', tags: [], source: 'gemini' },
  ] };

  it('Firecrawl tem prioridade nos campos e nos POIs duplicados', () => {
    const merged = mergeDiscovery(
      { sourceUrls: ['https://a.test'], meta: { summary: 'Resumo do guia', hero_image_url: 'https://img.test/h.jpg' }, pois: [{ name: 'Torre de Belem', type: 'attraction' }], costs: { low: 1, mid: 2, high: 3 }, failures: [] },
      llm,
      { query: 'lisboa', country: '', city: '' },
    );
    expect(merged).toMatchObject({ name: 'Lisboa', country: 'Portugal', summary: 'Resumo do guia', bestSeason: 'Primavera', heroImageUrl: 'https://img.test/h.jpg', hasData: true });
    expect(merged.pois.map((poi) => poi.name)).toEqual(['Torre de Belem', 'Alfama']);
    expect(merged.sources).toEqual({ firecrawl: true, gemini: true, groq: false });
  });

  it('sem nenhuma fonte usa a busca como nome e marca sem dados', () => {
    const merged = mergeDiscovery(null, emptyEnrichment(), { query: 'vila nova', country: '', city: '' });
    expect(merged).toMatchObject({ name: 'Vila Nova', country: 'Desconhecido', hasData: false });
  });
});

describe('isReachableImage', () => {
  const response = (status: number, type = 'image/jpeg') => new Response(null, { status, headers: { 'content-type': type } });

  it('aceita imagem, recusa HTML/404 e tenta GET quando HEAD e recusado', async () => {
    await expect(isReachableImage('https://a.test/x.jpg', jest.fn().mockResolvedValue(response(200)))).resolves.toBe(true);
    await expect(isReachableImage('https://a.test/x', jest.fn().mockResolvedValue(response(200, 'text/html')))).resolves.toBe(false);
    await expect(isReachableImage('https://a.test/x', jest.fn().mockResolvedValue(response(404)))).resolves.toBe(false);
    const fetchFn = jest.fn().mockResolvedValueOnce(response(405)).mockResolvedValueOnce(response(200, 'image/webp'));
    await expect(isReachableImage('https://a.test/x', fetchFn)).resolves.toBe(true);
    expect(fetchFn.mock.calls.map((call) => call[1].method)).toEqual(['HEAD', 'GET']);
    await expect(isReachableImage('https://cdn.example.com/x.jpg', jest.fn().mockRejectedValue(new TypeError('fetch failed')))).resolves.toBe(false);
  });

  it('filterReachableImages devolve so as acessiveis', async () => {
    const fetchFn = jest.fn((url: string) => Promise.resolve(response(url.includes('ok') ? 200 : 404)));
    await expect(filterReachableImages(['https://ok.test/a.jpg', 'https://bad.test/b.jpg', ''], fetchFn as never)).resolves.toEqual(new Set(['https://ok.test/a.jpg']));
  });
});

describe('fetchWikipediaThumbnail', () => {
  const page = (body: Record<string, unknown>, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
  const photo = (name: string) => ({ originalimage: { source: `https://upload.wikimedia.org/${name}.jpg` } });

  it('usa o titulo com regiao antes do nome puro', async () => {
    const fetchFn = jest.fn((url: string) => (url.includes('Formiga_(Minas_Gerais)') ? page(photo('cidade')) : page(photo('inseto'))));
    await expect(fetchWikipediaThumbnail('Formiga', { region: 'Minas Gerais' }, fetchFn as never)).resolves.toBe('https://upload.wikimedia.org/cidade.jpg');
  });

  it('nome puro so vale se a pagina for do lugar', async () => {
    const person = { ...photo('pessoa'), description: 'militar e revolucionario brasileiro' };
    const town = { ...photo('cidade'), description: 'municipio de Minas Gerais, Brasil' };
    const onlyBare = (body: Record<string, unknown>) => jest.fn((url: string) => (url.includes('(') ? page({}, 404) : page(body)));
    await expect(fetchWikipediaThumbnail('Tiradentes', { region: 'Minas Gerais' }, onlyBare(person) as never)).resolves.toBe('');
    await expect(fetchWikipediaThumbnail('Tiradentes', { region: 'Minas Gerais' }, onlyBare(town) as never)).resolves.toBe('https://upload.wikimedia.org/cidade.jpg');
    await expect(fetchWikipediaThumbnail('X', {}, onlyBare({ ...photo('d'), type: 'disambiguation', description: 'cidade' }) as never)).resolves.toBe('');
  });

  it('limita miniaturas da Wikimedia a 1280px', () => {
    expect(limitWikimediaWidth('https://thumb.wikimedia.org/a/b/X.jpg/3840px-X.jpg?utm_source=pt')).toBe('https://thumb.wikimedia.org/a/b/X.jpg/1280px-X.jpg?utm_source=pt');
    expect(limitWikimediaWidth('https://upload.wikimedia.org/a/b/X.jpg')).toBe('https://upload.wikimedia.org/a/b/X.jpg');
  });

  it('looksLikePlace exige palavra de lugar e dica como palavra inteira', () => {
    expect(looksLikePlace({ description: 'capital of France' }, [])).toBe(true);
    expect(looksLikePlace({ description: 'genus of insects' }, [])).toBe(false);
    expect(looksLikePlace({ description: 'militar brasileiro', extract: 'Atuou no Brasil colonial.' }, ['Brasil'])).toBe(false);
    expect(looksLikePlace({ description: 'municipio brasileiro do estado de Minas Gerais' }, ['Minas Gerais', 'Brasil'])).toBe(true);
    expect(looksLikePlace({ description: 'cidade do Japao' }, ['Brasil'])).toBe(false);
  });
});

describe('normalizePoiType', () => {
  it.each([['hotel', 'lodging'], ['Rooftop bar', 'restaurant'], ['museum', 'attraction'], ['qualquer', 'activity'], ['restaurant', 'restaurant']])('%s -> %s', (raw, expected) => {
    expect(normalizePoiType(raw)).toBe(expected);
  });
});

describe('FirecrawlClient', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  const client = (env: Record<string, string> = { FIRECRAWL_API_KEY: 'fc' }) => new FirecrawlClient(new ConfigService(env));
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('filtra hosts sem suporte e monta fallback da Wikipedia', () => {
    expect(isSupportedUrl('https://www.instagram.com/p/1')).toBe(false);
    expect(isSupportedUrl('https://guia.test/lisboa')).toBe(true);
    expect(wikipediaFallbackUrl('São Paulo')).toBe('https://pt.wikipedia.org/wiki/S%C3%A3o_Paulo');
    expect(wikipediaFallbackUrl('Formiga', 'Minas Gerais')).toBe('https://pt.wikipedia.org/wiki/Formiga_(Minas_Gerais)');
  });

  it('sem chave nao chama a API', async () => {
    const fetchFn = jest.fn();
    await expect(client({}).useFetch(fetchFn).discover('Lisboa')).resolves.toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('agrega ate ter resumo + POIs e tolera URL que falha', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(json({ success: true, data: [{ url: 'https://a.test' }, { url: 'https://www.facebook.com/x/' }, { url: 'https://b.test' }, { url: 'https://c.test' }] }))
      .mockResolvedValueOnce(json({ error: 'boom' }, 500))
      .mockResolvedValueOnce(json({ success: true, data: { json: { summary: 'Resumo', pois: [{ name: 'Torre' }], costs: { low: 1, mid: 2, high: 3 } } } }));
    const result = await client().useFetch(fetchFn).discover('Lisboa', 'Portugal');
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({ query: 'Lisboa turismo Portugal', limit: 2 });
    expect(result).toMatchObject({ meta: { summary: 'Resumo' }, pois: [{ name: 'Torre', source_url: 'https://b.test' }], costs: { low: 1 } });
    expect(result?.failures).toHaveLength(1);
  });

  it('para de fazer scrape quando o prazo acaba', async () => {
    const fetchFn = jest.fn();
    await expect(client().useFetch(fetchFn).aggregate(['https://a.test'], Date.now() + 1000)).rejects.toThrow('Tempo da descoberta esgotado');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('abre o circuit breaker apos 3 falhas e cache negativo por slug', () => {
    const firecrawl = client();
    firecrawl.recordFailure();
    firecrawl.recordFailure();
    expect(firecrawl.isCircuitOpen()).toBe(false);
    firecrawl.recordFailure();
    expect(firecrawl.isCircuitOpen()).toBe(true);
    firecrawl.recordSuccess();
    expect(firecrawl.isCircuitOpen()).toBe(false);
    firecrawl.markRecentlyFailed('lisboa');
    expect(firecrawl.isRecentlyFailed('lisboa')).toBe(true);
  });
});
