export const normalizeDestinationText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

const CITIES: Record<string, string> = {
  lisbon: 'Lisboa', tokyo: 'Tóquio', kyoto: 'Quioto', florence: 'Florença', rome: 'Roma', venice: 'Veneza',
  milan: 'Milão', naples: 'Nápoles', london: 'Londres', munich: 'Munique', vienna: 'Viena', prague: 'Praga',
  athens: 'Atenas', 'new york': 'Nova York', 'mexico city': 'Cidade do México', copenhagen: 'Copenhague',
  warsaw: 'Varsóvia', moscow: 'Moscou', zurich: 'Zurique', beijing: 'Pequim', seoul: 'Seul',
};
const REGIONS = 'BR PT JP AR US GB FR DE IT ES CA MX CL PE UY CO BO EC CN KR TH ID VN AU NZ GR CH AT NL BE DK SE NO FI IE PL CZ HU TR EG MA ZA IN AE SA RU'.split(' ');
const englishRegions = new Intl.DisplayNames(['en'], { type: 'region' });
const portugueseRegions = new Intl.DisplayNames(['pt-BR'], { type: 'region' });

export function portuguesePlaceName(value: string): string {
  return CITIES[normalizeDestinationText(value)] ?? value;
}
export function portugueseCountry(value: string): string {
  const normalized = normalizeDestinationText(value);
  const aliases: Record<string, string> = { usa: 'US', 'united states of america': 'US', uk: 'GB', england: 'GB', 'south korea': 'KR' };
  const code = aliases[normalized] ?? REGIONS.find(region => [region, englishRegions.of(region) ?? '', portugueseRegions.of(region) ?? ''].some(name => normalizeDestinationText(name) === normalized));
  return code ? portugueseRegions.of(code) ?? value : value;
}
export interface SearchableDestination {
  name: string; city?: string | null; country?: string | null; summary?: string | null;
  metadata?: Record<string, unknown> | null;
  pois?: { tags?: { name: string }[] | null }[] | null;
}
export function destinationSearchTerms(destination: SearchableDestination): string[] {
  const { name, city, country, summary, metadata } = destination;
  const aliases = Array.isArray(metadata?.search_aliases) ? metadata.search_aliases.filter((value): value is string => typeof value === 'string') : [];
  const localized = metadata?.name_pt;
  return [name, portuguesePlaceName(name), city ?? '', portuguesePlaceName(city ?? ''), country ?? '', portugueseCountry(country ?? ''), summary ?? '', typeof localized === 'string' ? localized : '', ...aliases, ...(destination.pois ?? []).flatMap(poi => (poi.tags ?? []).map(tag => tag.name))];
}
export function matchesDestinationQuery(destination: SearchableDestination, query: string): boolean {
  const terms = normalizeDestinationText(query).split(/\s+/).filter(Boolean);
  const haystack = normalizeDestinationText(destinationSearchTerms(destination).join(' '));
  return terms.every(term => haystack.includes(term));
}
export function localizedDestination<T extends SearchableDestination>(destination: T): T {
  return { ...destination,
    name: typeof destination.metadata?.name_pt === 'string' ? destination.metadata.name_pt : portuguesePlaceName(destination.name),
    city: portuguesePlaceName(destination.city ?? ''), country: portugueseCountry(destination.country ?? ''),
    metadata: { ...destination.metadata, search_aliases: [...new Set(destinationSearchTerms(destination))] },
  };
}
