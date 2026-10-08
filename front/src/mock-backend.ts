/**
 * TEMPORÁRIO. PowerShell: $env:VITE_MOCK_API='true'; npm run dev
 * Login: qualquer email válido e senha não vazia. Cadastro reinicia o onboarding.
 * Console: localStorage.setItem('viajero.mock.scenario', 'empty' | 'error' | 'success')
 * Reset: localStorage.removeItem('viajero.mock.data.v1'); recarregue a página.
 * Remoção: apague este arquivo e desative VITE_MOCK_API. Não há dependências extras.
 * Dados e autenticação são simulados; nenhuma senha é armazenada.
 */
import { getApiBaseUrl } from './lib/api';
import type { AuthUser } from './lib/auth';
import type { TravelerDNAProfile, UserTripPreference } from './lib/profiles';
import type { Destination, Itinerary } from './types/travel';
import type { Poi } from './lib/pois';
import tripImage from './assets/trip-example.jpg';

const KEY = 'viajero.mock.data.v1';
const now = () => new Date().toISOString();
const destinations: Destination[] = [
  ['Salvador', 'Brasil', 'Praias, história e sabores da Bahia.', ['Praia', 'Cultura', 'Gastronomia'], 220],
  ['Lisboa', 'Portugal', 'Miradouros, bairros históricos e passeios à beira do Tejo.', ['Cultura', 'Gastronomia'], 480],
  ['Florianópolis', 'Brasil', 'Trilhas e praias para explorar com tranquilidade.', ['Praia', 'Natureza', 'Aventura'], 280],
  ['Gramado', 'Brasil', 'Passeios na serra, parques e boa gastronomia.', ['Natureza', 'Gastronomia'], 350],
  ['Rio de Janeiro', 'Brasil', 'Praias, museus e paisagens icônicas.', ['Praia', 'Cultura', 'Aventura'], 320],
  ['Buenos Aires', 'Argentina', 'Arte, cafés e arquitetura em bairros cheios de vida.', ['Cultura', 'Gastronomia'], 300],
].map(([name, country, summary, tags, cost], index) => ({
  id: index + 1, name: String(name), city: String(name), country: String(country),
  summary: String(summary), description: String(summary), slug: `destino-${index + 1}`,
  hero_image_url: tripImage, average_rating: 4.8,
  duration_days: 5, best_season: 'Primavera e outono', timezone: 'America/Sao_Paulo',
  tags: tags as string[], metadata: { tags },
  cost_profile: { daily_budget_mid: Number(cost), currency_code: 'BRL' },
}));
const pois: Poi[] = destinations.flatMap(destination => [
  ['Centro histórico', 'culture', '09:00–18:00'],
  ['Parque e miradouro', 'nature', '08:00–18:00'],
  ['Restaurante regional', 'restaurant', '12:00–22:00'],
].map(([name, type, hours], index) => ({
  id: Number(destination.id) * 10 + index, destination: Number(destination.id),
  name: `${name} de ${destination.name}`, slug: `poi-${destination.id}-${index}`,
  poi_type: type, summary: 'Experiência demonstrativa para validar o roteiro.',
  address: `Centro, ${destination.name}`, opening_hours: hours, source_url: '',
  price_level: index + 1, rating: 4.7, estimated_visit_minutes: 90, metadata: {},
})));
destinations.forEach(destination => { destination.pois = pois.filter(poi => poi.destination === destination.id); });

function makeItinerary(id: number, destination: Destination, title: string, duration = 5): Itinerary {
  return {
    id, title, destination, destination_name: destination.name, summary: `Explore ${destination.name} com atividades e tempo livre.`,
    duration_days: duration, budget_total: duration * 300, currency_code: 'BRL',
    generation_status: 'ready', image_url: destination.hero_image_url, rating: 4.8,
    start_date: '2026-11-10', end_date: `2026-11-${9 + duration}`,
    days: Array.from({ length: duration }, (_, index) => ({
      id: id * 10 + index, itinerary: id, day_number: index + 1,
      title: index === 0 ? 'Chegada e primeiras descobertas' : `Explorando ${destination.name}`,
      summary: 'Passeios, gastronomia e momentos para descansar.', estimated_cost: 300,
      events: (destination.pois ?? []).map((poi, order) => ({
        id: id * 100 + index * 10 + order, title: poi.name, description: poi.summary,
        start_time: ['09:00', '11:00', '13:00'][order], end_time: ['10:30', '12:30', '14:30'][order],
        estimated_cost: 80, order_index: order, poi: { ...poi },
      })),
    })),
  };
}
interface MockState {
  user: AuthUser;
  dna: TravelerDNAProfile | null;
  preferences: UserTripPreference | null;
  itineraries: Itinerary[];
}
function seed(): MockState {
  return {
    user: { id: 1, email: 'demo@viajero.local', username: 'demo', display_name: 'Viajante Demo', first_name: 'Viajante', last_name: 'Demo', avatar_url: null, home_airport: 'GRU', preferred_currency: 'BRL', is_profile_complete: true, created_at: now(), updated_at: now() },
    dna: { id: 1, user: 1, travel_style: 'balanced', pace: 'moderate', comfort_level: 'mid', social_energy: 3, adventure_level: 4, food_focus: 5, cultural_interest: 5, nature_interest: 4, nightlife_interest: 2, notes: 'Perfil demonstrativo', created_at: now(), updated_at: now() },
    preferences: { id: 1, user: 1, budget_min: '1000', budget_max: '5000', currency_code: 'BRL', companionship: 'couple', preferred_trip_length_days: 5, travel_month: '2026-11', hotel_level: 'standard', transportation_style: 'public', dietary_preferences: [], accessibility_needs: [], interests: ['culture', 'nature'], metadata: {}, created_at: now(), updated_at: now() },
    itineraries: [makeItinerary(101, destinations[0], 'Descobrindo Salvador'), makeItinerary(102, destinations[1], 'Cinco dias em Lisboa')],
  };
}
let state = seed();
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as MockState | null;
  if (saved?.user && Array.isArray(saved.itineraries)) state = saved;
} catch { /* Invalid saved fixtures are replaced with initial data. */ }
for (const itinerary of state.itineraries) {
  if (typeof itinerary.image_url === 'string' && /\/(hero\.png|pic-trip\.svg)/.test(itinerary.image_url)) itinerary.image_url = tripImage;
  if (itinerary.destination && typeof itinerary.destination === 'object' && typeof itinerary.destination.hero_image_url === 'string' && /\/(hero\.png|pic-trip\.svg)/.test(itinerary.destination.hero_image_url)) itinerary.destination.hero_image_url = tripImage;
}
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const reply = (data: unknown, status = 200) => Response.json({ success: status < 400, data }, { status });
const fail = (message: string, status: number) => Response.json({ success: false, message }, { status });
const originalFetch = window.fetch.bind(window);
const apiOrigin = new URL(getApiBaseUrl()).origin;

window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href);
  if (url.origin !== apiOrigin || !url.pathname.startsWith('/api/')) return originalFetch(input, init);
  const request = new Request(input, init);
  request.signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { request.signal.removeEventListener('abort', abort); resolve(); }, 350);
    request.signal.addEventListener('abort', abort, { once: true });
  });
  request.signal.throwIfAborted();
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;
  const scenario = localStorage.getItem('viajero.mock.scenario');
  if (scenario === 'error') return fail('Erro simulado. Altere o cenário para success e tente novamente.', 503);
  const empty = scenario === 'empty';
  const body = request.headers.get('Content-Type')?.includes('application/json') && method !== 'GET'
    ? await request.json() as Record<string, unknown> : {};

  if (path === '/api/auth/login' || path === '/api/auth/register') {
    if (method !== 'POST') return fail('Método não suportado pelo mock.', 405);
    if (!body.email || !body.password) return fail('Informe email e senha.', 400);
    if (path.endsWith('register')) {
      state = seed(); state.dna = null; state.preferences = null;
      state.user.is_profile_complete = false;
      state.user.display_name = String(body.display_name ?? 'Novo viajante');
      state.user.first_name = String(body.first_name ?? ''); state.user.last_name = String(body.last_name ?? '');
    }
    state.user.email = String(body.email); save();
    return reply({ access: 'viajero-mock-access', refresh: 'viajero-mock-refresh', user: state.user });
  }
  if (path === '/api/users/me/avatar' && method === 'POST') {
    const file = (await request.formData()).get('avatar');
    if (!(file instanceof File)) return fail('Selecione uma imagem.', 400);
    state.user.avatar_url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
    });
    save(); return reply(state.user);
  }
  if (path === '/api/users/me') {
    if (method === 'PATCH') {
      for (const key of ['display_name', 'first_name', 'last_name', 'home_airport', 'preferred_currency'] as const) {
        if (typeof body[key] === 'string') state.user[key] = body[key];
      }
      state.user.updated_at = now(); save();
    } else if (method !== 'GET') return fail('Método não suportado pelo mock.', 405);
    return reply(state.user);
  }
  if (/^\/api\/(traveler-dna|trip-preferences)(\/me)?$/.test(path)) {
    const key = path.includes('traveler-dna') ? 'dna' : 'preferences';
    if (method === 'PATCH' || method === 'POST') {
      const value = { ...state[key], ...body, id: 1, user: 1, created_at: state[key]?.created_at ?? now(), updated_at: now() };
      if (key === 'dna') state.dna = value as TravelerDNAProfile;
      else state.preferences = value as UserTripPreference;
      state.user.is_profile_complete = Boolean(state.dna && state.preferences); save();
    } else if (method !== 'GET') return fail('Método não suportado pelo mock.', 405);
    return reply(empty ? null : state[key]);
  }
  if (path === '/api/destinations/suggest' && method === 'POST') return reply(empty ? null : destinations[2]);
  if ((path === '/api/destinations' || path === '/api/destinations/search') && method === 'GET') {
    const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const query = normalize(url.searchParams.get('q') ?? '');
    return reply(empty ? [] : destinations.filter(item => normalize(`${item.name} ${item.country}`).includes(query)));
  }
  if (path === '/api/pois' && method === 'GET') return reply({ count: empty ? 0 : pois.length, next: null, previous: null, results: empty ? [] : pois });
  if (/^\/api\/itineraries(\/(top-rated|templates))?$/.test(path)) {
    if (method === 'GET') return reply(empty ? [] : state.itineraries);
    if (method === 'POST' && path === '/api/itineraries') {
      const destination = destinations.find(item => String(item.id) === String(body.destination));
      if (!destination) return fail('Destino não encontrado.', 400);
      const id = Math.max(100, ...state.itineraries.map(item => Number(item.id))) + 1;
      const itinerary = makeItinerary(id, destination, String(body.title ?? destination.name));
      itinerary.days = []; itinerary.generation_status = 'draft';
      state.itineraries.unshift(itinerary); save(); return reply(itinerary, 201);
    }
  }
  const match = path.match(/^\/api\/itineraries\/(\d+)(\/generate)?$/);
  if (match) {
    const itinerary = state.itineraries.find(item => String(item.id) === match[1]);
    if (!itinerary) return fail('Roteiro não encontrado.', 404);
    if (match[2] && method === 'POST') {
      itinerary.generation_status = 'generating'; itinerary.mock_ready_at = Date.now() + 1600; save();
      return reply(itinerary, 202);
    }
    if (!match[2] && method === 'PATCH') {
      Object.assign(itinerary, body); save(); return reply(itinerary);
    }
    if (!match[2] && method === 'GET') {
      if (itinerary.generation_status === 'generating' && Date.now() >= Number(itinerary.mock_ready_at)) {
        const destination = itinerary.destination as Destination;
        itinerary.days = makeItinerary(Number(itinerary.id), destination, itinerary.title).days;
        itinerary.generation_status = 'ready'; delete itinerary.mock_ready_at; save();
      }
      return reply(itinerary);
    }
  }
  return fail(`Endpoint não implementado no mock: ${method} ${path}`, 404);
};
console.info('[Viajero] Mock local ativo. Login: qualquer email válido e senha não vazia.');
