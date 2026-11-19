import type { GeneratedItinerary } from '../../itinerary-generators';
import { TtlCache } from '../../../destinations/discovery/ttl-cache';
import { applyBudgetPrecision } from '../itinerary-costs';
import { normalizeEventDetails } from '../itinerary-details';
import { applyCostSources, resolveCostSource } from '../cost-sources';
import { enrichPlaces } from '../place-enrichment';
import { FoursquarePlaceProvider } from '../places/foursquare.provider';
import { OsmPlaceProvider, extractOgImage } from '../places/osm.provider';
import { PlaceChain, PlaceInfo, PlaceProvider, PlaceProviderUnavailableError, sameName } from '../places/place-provider';
import { TripadvisorPlaceProvider, priceLevelTier } from '../places/tripadvisor.provider';

type Route = (url: string, init?: RequestInit) => { status?: number; json?: unknown; text?: string; contentType?: string } | undefined;

/** fetch falso: cada rota devolve JSON, HTML ou imagem; o resto e 404. */
function fakeFetch(route: Route) {
  const calls: string[] = [];
  const fn = jest.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    const answer = route(url, init);
    const status = answer?.status ?? (answer ? 200 : 404);
    const contentType = answer?.contentType ?? (answer?.json !== undefined ? 'application/json' : 'text/html');
    return {
      ok: status >= 200 && status < 300,
      status,
      url,
      headers: new Headers({ 'content-type': contentType }),
      json: async () => answer?.json,
      text: async () => answer?.text ?? JSON.stringify(answer?.json ?? ''),
      body: null,
    } as unknown as Response;
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe('sameName', () => {
  it.each([
    ['Pasteis de Belem', 'Pastéis de Belém', true],
    ['Hotel Chiado Seed', 'Chiado Seed Hotel Lisboa', true],
    ['Time Out Market', 'Mercado da Ribeira', false],
    ['Mosteiro dos Jeronimos', 'Mosteiro dos Jerónimos, Belém, Lisboa', true],
  ])('%p x %p -> %p', (wanted, found, expected) => expect(sameName(wanted, found)).toBe(expected));
});

describe('extractOgImage', () => {
  it('le og:image com aspas simples ou duplas e resolve URL relativa', () => {
    expect(extractOgImage(`<head><meta content='/img/fachada.jpg' property='og:image'></head>`, 'https://pasteis.pt/pt/')).toBe('https://pasteis.pt/img/fachada.jpg');
    expect(extractOgImage('<meta name="twitter:image" content="https://cdn.x.pt/a.png?w=1200&amp;q=80">', 'https://x.pt')).toBe('https://cdn.x.pt/a.png?w=1200&q=80');
    expect(extractOgImage('<meta property="og:image" content="https://x.pt/logo.svg">', 'https://x.pt')).toBe('');
    expect(extractOgImage('<title>sem imagem</title>', 'https://x.pt')).toBe('');
  });
});

describe('OsmPlaceProvider', () => {
  const nominatim = (website?: string, image?: string) => [
    { name: 'Pastéis de Belém', lat: '38.6975', lon: '-9.2032', osm_type: 'node', osm_id: 123, extratags: { ...(website ? { website } : {}), ...(image ? { image } : {}) } },
  ];

  it('coordenadas, site e foto do og:image do site (conferida como imagem)', async () => {
    const { fn, calls } = fakeFetch((url) => {
      if (url.startsWith('https://nominatim')) return { json: nominatim('https://pasteisdebelem.pt') };
      if (url === 'https://pasteisdebelem.pt') return { text: '<meta property="og:image" content="https://pasteisdebelem.pt/foto.jpg">' };
      if (url === 'https://pasteisdebelem.pt/foto.jpg') return { contentType: 'image/jpeg', text: '' };
      return undefined;
    });
    const provider = new OsmPlaceProvider(fn, () => 0, async () => undefined);
    const info = await provider.lookup({ name: 'Pasteis de Belem', city: 'Lisboa', country: 'Portugal' }, new Set(['image']));
    expect(info).toEqual({
      coordinates: { lat: 38.6975, lon: -9.2032 },
      website: 'https://pasteisdebelem.pt',
      links: [{ kind: 'osm', label: 'OpenStreetMap', url: 'https://www.openstreetmap.org/node/123' }],
      image_url: 'https://pasteisdebelem.pt/foto.jpg',
      image_credit: { label: 'pasteisdebelem.pt', url: 'https://pasteisdebelem.pt' },
    });
    // So o nome do lugar e a cidade vao para o Nominatim.
    expect(new URL(calls[0].slice(4)).searchParams.get('q')).toBe('Pasteis de Belem, Lisboa, Portugal');
  });

  it('descarta foto que nao responde como imagem e resultado com outro nome', async () => {
    const { fn } = fakeFetch((url) => {
      if (url.startsWith('https://nominatim')) return { json: nominatim('https://site.pt') };
      if (url === 'https://site.pt') return { text: '<meta property="og:image" content="https://site.pt/quebrada.jpg">' };
      return undefined;
    });
    const provider = new OsmPlaceProvider(fn, () => 0, async () => undefined);
    const info = await provider.lookup({ name: 'Pasteis de Belem', city: 'Lisboa', country: '' }, new Set(['image']));
    expect(info?.image_url).toBeUndefined();
    expect(await provider.lookup({ name: 'Time Out Market', city: 'Lisboa', country: '' }, new Set())).toBeNull();
  });

  it('respeita 1 requisicao por segundo no Nominatim', async () => {
    let clock = 0;
    const waits: number[] = [];
    const { fn } = fakeFetch((url) => (url.startsWith('https://nominatim') ? { json: [] } : undefined));
    const provider = new OsmPlaceProvider(fn, () => clock, async (ms) => {
      waits.push(ms);
      clock += ms;
    });
    clock = 5000;
    await Promise.all(['A', 'B', 'C'].map((name) => provider.lookup({ name, city: 'X', country: '' }, new Set())));
    expect(waits).toEqual([1100, 1100]);
  });
});

describe('Foursquare e Tripadvisor', () => {
  it('Foursquare: foto original, site, nota 0-10, faixa de preco e link', async () => {
    const { fn, calls } = fakeFetch(() => ({
      json: { results: [{ fsq_place_id: 'abc', name: 'Pastéis de Belém', latitude: 38.69, longitude: -9.2, website: 'https://pasteis.pt', rating: 9.1, price: 1, photos: [{ prefix: 'https://fastly.4sqi.net/img/general/', suffix: '/x.jpg' }] }] },
    }));
    const info = await new FoursquarePlaceProvider('KEY', fn).lookup({ name: 'Pasteis de Belem', city: 'Lisboa', country: 'Portugal' }, new Set());
    expect(info).toMatchObject({
      image_url: 'https://fastly.4sqi.net/img/general/original/x.jpg',
      website: 'https://pasteis.pt',
      rating: { value: 9.1, scale: 10, provider: 'Foursquare' },
      price_tier: { tier: 1, provider: 'Foursquare' },
      links: [{ kind: 'reviews', url: 'https://foursquare.com/v/abc' }],
    });
    expect(calls[0]).toContain('near=Lisboa%2C+Portugal');
  });

  it('Foursquare: credencial recusada tira o provedor da cadeia', async () => {
    const { fn } = fakeFetch(() => ({ status: 401, json: {} }));
    await expect(new FoursquarePlaceProvider('KEY', fn).lookup({ name: 'A', city: 'B', country: '' }, new Set())).rejects.toBeInstanceOf(PlaceProviderUnavailableError);
  });

  it('Tripadvisor: busca, detalhes e foto so quando falta foto', async () => {
    const { fn, calls } = fakeFetch((url) => {
      if (url.includes('/search')) return { json: { data: [{ location_id: 42, name: 'Pastéis de Belém' }] } };
      if (url.includes('/42/details')) return { json: { web_url: 'https://www.tripadvisor.com/R-42', rating: '4.5', price_level: '$$ - $$$', latitude: '38.7', longitude: '-9.2' } };
      if (url.includes('/42/photos')) return { json: { data: [{ images: { large: { url: 'https://media.tacdn.com/p.jpg' } } }] } };
      return undefined;
    });
    const provider = new TripadvisorPlaceProvider('KEY', fn);
    const query = { name: 'Pasteis de Belem', city: 'Lisboa', country: '', kind: 'meal' as const };
    const withPhoto = await provider.lookup(query, new Set(['image']));
    expect(withPhoto).toMatchObject({
      rating: { value: 4.5, scale: 5 },
      price_tier: { tier: 2 },
      image_url: 'https://media.tacdn.com/p.jpg',
      links: [{ kind: 'reviews', label: 'Avaliações no Tripadvisor', url: 'https://www.tripadvisor.com/R-42' }],
    });
    expect(calls[0]).toContain('category=restaurants');
    calls.length = 0;
    await provider.lookup(query, new Set(['rating']));
    expect(calls.some((call) => call.includes('/photos'))).toBe(false);
    expect(priceLevelTier('$$$$')).toBe(4);
    expect(priceLevelTier('')).toBeUndefined();
  });
});

describe('PlaceChain', () => {
  const provider = (key: string, answer: PlaceInfo | null | Error): PlaceProvider & { lookup: jest.Mock } => ({
    key,
    lookup: jest.fn(async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  });

  it('o primeiro provedor manda; os seguintes so completam; para quando tem tudo', async () => {
    const first = provider('a', { image_url: 'https://a/img.jpg', image_credit: { label: 'A' }, website: 'https://site' });
    const second = provider('b', { image_url: 'https://b/img.jpg', rating: { value: 4, scale: 5, provider: 'B' }, coordinates: { lat: 1, lon: 2 } });
    const chain = new PlaceChain([first, second], new TtlCache());
    const info = await chain.lookup({ name: 'X', city: 'Y', country: '' });
    expect(info).toMatchObject({ image_url: 'https://a/img.jpg', website: 'https://site', rating: { value: 4 }, coordinates: { lat: 1, lon: 2 } });
    // O segundo recebe o site ja conhecido (para o og:image).
    expect(second.lookup.mock.calls[0][0]).toMatchObject({ website: 'https://site' });
  });

  it('provedor sem cota sai da cadeia; erro comum nao vira cache; resultado vai para o cache', async () => {
    const paid = provider('paid', new PlaceProviderUnavailableError('cota'));
    const osm = provider('osm', { coordinates: { lat: 1, lon: 1 } });
    const chain = new PlaceChain([paid, osm], new TtlCache());
    await chain.lookup({ name: 'A', city: 'C', country: '' });
    await chain.lookup({ name: 'B', city: 'C', country: '' });
    await chain.lookup({ name: 'A', city: 'C', country: '' });
    expect(paid.lookup).toHaveBeenCalledTimes(1);
    expect(osm.lookup).toHaveBeenCalledTimes(2);

    const flaky = provider('flaky', new Error('rede'));
    const chain2 = new PlaceChain([flaky], new TtlCache());
    expect(await chain2.lookup({ name: 'A', city: 'C', country: '' })).toBeNull();
    await chain2.lookup({ name: 'A', city: 'C', country: '' });
    expect(flaky.lookup).toHaveBeenCalledTimes(2);
  });
});

const itinerary = (): GeneratedItinerary => ({
  title: 'T', summary: '', currency_code: 'BRL', estimated_cost: '0', metadata: {},
  days: [{
    title: 'D1', summary: '',
    events: [
      { title: 'Almoco no Pasteis', description: '', estimated_cost: '150.00', order_index: 0, details: { kind: 'meal', place_name: 'Pasteis de Belem', cost_basis: 'meal_budget' } },
      { title: 'Torre', description: '', estimated_cost: '50.00', order_index: 1, poi_id: 1, details: { kind: 'attraction', cost_basis: 'poi_ticket' } },
      { title: 'Metro', description: '', estimated_cost: '9.00', order_index: 2, details: { kind: 'transport', cost_basis: 'public_transport_ride', location: 'Baixa' } },
      { title: 'Hotel', description: '', estimated_cost: '650.00', order_index: 3, details: { kind: 'lodging', place_name: 'Hotel Chiado Seed', cost_basis: 'hotel_night' } },
      { title: 'Jantar', description: '', estimated_cost: '200.00', order_index: 4, details: { kind: 'meal', cost_basis: 'meal_vip' as never } },
      { title: 'Miradouro', description: '', estimated_cost: '0.00', order_index: 5, details: { kind: 'free_time' } },
    ],
  }],
});

describe('origem dos custos', () => {
  const ctx = {
    benchmarks: { meal_budget: '75.00', public_transport_ride: '9.00', hotel_night: '600.00' },
    benchmarksSource: 'https://en.wikivoyage.org/wiki/Lisbon',
    ticketByPoi: new Map([[1, 45]]),
    nightlyCost: 650,
  };

  it('referencia do guia com fonte, ingresso da analise, diaria do plano, gratuito e media da IA', () => {
    const result = itinerary();
    applyCostSources(result, ctx);
    expect(result.days[0].events.map((event) => event.details?.cost_source)).toEqual([
      { basis: 'meal_budget', label: 'Referência do guia (Wikivoyage)', reference: '75.00', source_url: ctx.benchmarksSource },
      { basis: 'poi_ticket', label: 'Ingresso estimado na análise do local', reference: '45.00' },
      { basis: 'public_transport_ride', label: 'Referência do guia (Wikivoyage)', reference: '9.00', source_url: ctx.benchmarksSource },
      { basis: 'hotel_night', label: 'Diária do hotel do plano · Referência do guia (Wikivoyage)', reference: '650.00', source_url: ctx.benchmarksSource },
      { basis: 'estimate', label: 'Média estimada pela IA' },
      { basis: 'free', label: 'Gratuito ou sem custo previsto' },
    ]);
  });

  it('em grupo, referencias por pessoa levam o numero de viajantes (diaria e taxi nao)', () => {
    const result = itinerary();
    applyCostSources(result, { ...ctx, travelers: 2 });
    const [meal, torre, metro, hotel] = result.days[0].events.map((event) => event.details?.cost_source);
    expect([meal?.travelers, torre?.travelers, metro?.travelers, hotel?.travelers]).toEqual([2, 2, 2, undefined]);
  });

  it('sem fonte do guia, a referencia vira media estimada pela IA', () => {
    const event = itinerary().days[0].events[0];
    expect(resolveCostSource(event, { benchmarks: ctx.benchmarks })).toEqual({ basis: 'meal_budget', label: 'Média estimada pela IA', reference: '75.00' });
    expect(resolveCostSource(event, {})).toEqual({ basis: 'estimate', label: 'Média estimada pela IA' });
  });

  it('applyBudgetPrecision guarda o valor original quando reescala', () => {
    const result = itinerary();
    applyCostSources(result, ctx);
    applyBudgetPrecision(result, { budget_min: 0, budget_max: 529.5 }); // metade do total (1059)
    const metro = result.days[0].events[2];
    expect(metro.estimated_cost).toBe('4.50');
    expect(metro.details?.cost_source?.adjusted).toEqual({ original: '9.00', factor: 0.5 });
    expect(result.days[0].events[5].details?.cost_source?.adjusted).toBeUndefined();
  });

  it('o LLM nao consegue mandar links nem fotos', () => {
    expect(normalizeEventDetails({ kind: 'meal', place_name: ' Pasteis ', cost_basis: 'MEAL_MID', links: [{ url: 'https://x' }], image_url: 'https://x/y.jpg' })).toEqual({
      kind: 'meal', place_name: 'Pasteis', cost_basis: 'meal_mid',
    });
  });
});

describe('enrichPlaces', () => {
  const pois = [{ id: '1', name: 'Torre de Belem', source_url: 'https://www.google.com/search?q=torre', metadata: { image_url: 'https://images.unsplash.com/torre.jpg', image_source: 'https://unsplash.com' } }];
  const destination = { name: 'Lisboa', city: 'Lisboa', country: 'Portugal' };

  it('link do Maps para todo lugar, dados da cadeia, foto do POI como reserva e aviso de faixa de preco', async () => {
    const lookup = jest.fn(async ({ name }: { name: string }): Promise<PlaceInfo | null> =>
      name === 'Pasteis de Belem'
        ? { website: 'https://pasteis.pt', image_url: 'https://pasteis.pt/f.jpg', image_credit: { label: 'Foursquare' }, price_tier: { tier: 3, provider: 'Foursquare' }, rating: { value: 9, scale: 10, provider: 'Foursquare' } }
        : null,
    );
    const chain = { keys: ['foursquare', 'osm'], lookup } as unknown as PlaceChain;
    const result = itinerary();
    const stats = await enrichPlaces(result, { pois: pois as never, destination, places: chain });
    const [meal, torre, metro, hotel, jantar] = result.days[0].events;

    expect(meal.details).toMatchObject({
      image_url: 'https://pasteis.pt/f.jpg',
      image_credit: { label: 'Foursquare' },
      price_tier: { tier: 3 },
      links: [
        { kind: 'maps', url: 'https://www.google.com/maps/search/?api=1&query=Pasteis%20de%20Belem%2C%20Lisboa%2C%20Portugal' },
        { kind: 'website', url: 'https://pasteis.pt' },
      ],
    });
    // POI sem resultado: foto do cadastro e nenhum "site" vindo de busca do Google.
    expect(torre.details?.image_url).toBe('https://images.unsplash.com/torre.jpg');
    expect(torre.details?.image_credit).toEqual({ label: 'unsplash.com', url: 'https://unsplash.com' });
    expect(torre.details?.links?.map((link) => link.kind)).toEqual(['maps']);
    // Transporte nao e consultado, mas ganha o link do local; evento generico fica sem link.
    expect(metro.details?.links?.[0].url).toContain('query=Baixa');
    expect(jantar.details?.links).toBeUndefined();
    expect(hotel.details?.links?.[0].url).toContain('Hotel%20Chiado%20Seed');

    expect(lookup.mock.calls.map(([query]) => query.name)).toEqual(['Pasteis de Belem', 'Torre de Belem', 'Hotel Chiado Seed']);
    expect(stats).toMatchObject({ looked_up: 3, found: 1, images: 1, websites: 1 });
    expect(stats.warnings).toEqual(['Dia 1: "Almoco no Pasteis" é caro segundo Foursquare, mas o custo usa a refeição econômica.']);
  });

  it('sem cadeia (busca desligada) so monta os links do Maps', async () => {
    const result = itinerary();
    const stats = await enrichPlaces(result, { pois: [] as never, destination });
    expect(stats.looked_up).toBe(0);
    expect(result.days[0].events[0].details?.links).toHaveLength(1);
  });
});
