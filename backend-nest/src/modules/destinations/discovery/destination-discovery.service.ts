import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Destination, DestinationCostProfile, PoiTag, PointOfInterest } from '../entities';
import { AggregatedExtraction, ExtractedCosts, FirecrawlClient } from './firecrawl.client';
import { DestinationAiService } from './destination-ai.service';
import { EnrichmentResult, VALID_POI_TYPES, hasMeaningfulEnrichment } from './destination-prompts';
import { fetchWikipediaThumbnail } from './wikipedia';
import { filterReachableImages, isReachableImage } from './image-check';
import { cleanImageUrl, cleanUrl, slugify, titleCase } from './slug';

const POI_TYPE_ALIASES: Record<string, string> = {
  hotel: 'lodging', hostel: 'lodging', pousada: 'lodging', resort: 'lodging', 'vacation rental': 'lodging',
  apartment: 'lodging', apartamento: 'lodging', tour: 'activity', experience: 'activity', experiencia: 'activity',
  atracao: 'attraction', sight: 'attraction', landmark: 'attraction', museum: 'attraction', park: 'attraction',
  bar: 'restaurant', cafe: 'restaurant', food: 'restaurant',
};

export function normalizePoiType(raw: unknown): string {
  const candidate = String(raw ?? '').trim().toLowerCase();
  if (VALID_POI_TYPES.includes(candidate)) return candidate;
  if (POI_TYPE_ALIASES[candidate]) return POI_TYPE_ALIASES[candidate];
  const alias = Object.keys(POI_TYPE_ALIASES).find((key) => candidate.includes(key));
  return alias ? POI_TYPE_ALIASES[alias] : 'activity';
}

export interface DiscoveryPoi {
  name?: unknown;
  type?: unknown;
  tags?: unknown;
  summary?: unknown;
  image_url?: unknown;
  source?: string;
  source_url?: string;
}

export interface MergedDiscovery {
  name: string;
  country: string;
  city: string;
  summary: string;
  bestSeason: string;
  timezone: string;
  heroImageUrl: string;
  pois: DiscoveryPoi[];
  costs: ExtractedCosts | null;
  sourceUrls: string[];
  extractedMeta: Record<string, unknown>;
  scrapeFailures: Array<{ url: string; error: string }>;
  sources: { firecrawl: boolean; gemini: boolean; groq: boolean };
  llmSource: string;
  llmModel: string;
  hasData: boolean;
}

/** Junta Firecrawl e LLM: Firecrawl tem prioridade nos campos e nos POIs (dedupe por slug). */
export function mergeDiscovery(firecrawl: AggregatedExtraction | null, llm: EnrichmentResult, input: { query: string; country: string; city: string }): MergedDiscovery {
  const meta = firecrawl?.meta ?? {};
  const pick = (key: 'name' | 'country' | 'city' | 'summary' | 'best_season' | 'timezone') => {
    const value = meta[key];
    return (typeof value === 'string' && value.trim()) || llm[key] || '';
  };
  const pois: DiscoveryPoi[] = [...(firecrawl?.pois ?? [])];
  const seen = new Set(pois.map((poi) => slugify(String(poi.name ?? ''))));
  for (const poi of llm.pois) {
    const slug = slugify(poi.name);
    if (!slug || seen.has(slug)) continue;
    pois.push(poi);
    seen.add(slug);
  }
  const llmHasData = hasMeaningfulEnrichment(llm);
  const summary = pick('summary');
  return {
    name: pick('name') || titleCase(input.query),
    country: pick('country') || input.country || 'Desconhecido',
    city: pick('city') || input.city,
    summary,
    bestSeason: pick('best_season'),
    timezone: pick('timezone'),
    heroImageUrl: cleanImageUrl(meta.hero_image_url),
    pois,
    costs: firecrawl?.costs ?? null,
    sourceUrls: firecrawl?.sourceUrls ?? [],
    extractedMeta: meta,
    scrapeFailures: firecrawl?.failures ?? [],
    sources: { firecrawl: firecrawl !== null, gemini: llmHasData && llm.source === 'gemini', groq: llmHasData && llm.source === 'groq' },
    llmSource: llm.source,
    llmModel: llm.model,
    hasData: Boolean(summary) || pois.length > 0,
  };
}

const hasAllCosts = (costs: ExtractedCosts | null): costs is Required<ExtractedCosts> =>
  !!costs && (['low', 'mid', 'high'] as const).every((key) => costs[key] !== null && costs[key] !== undefined && Number.isFinite(Number(costs[key])));

/**
 * Descoberta de destino que nao existe no banco (paridade com o DestinationDiscoveryService do Django):
 * Firecrawl e LLM em paralelo, merge, persistencia de destino/POIs/tags/custos e imagem da Wikipedia.
 */
@Injectable()
export class DestinationDiscoveryService {
  private readonly logger = new Logger(DestinationDiscoveryService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly firecrawl: FirecrawlClient,
    private readonly ai: DestinationAiService,
  ) {}

  /** Ha alguma fonte externa configurada (Firecrawl ou chave de LLM)? */
  isAvailable(): boolean {
    return this.firecrawl.isConfigured() || this.ai.isAvailable();
  }

  async discover(input: { query: string; country?: string; city?: string; region?: string; actorId?: number | null }): Promise<number | null> {
    const query = input.query.trim();
    const slug = slugify(query);
    if (!slug) return null;
    if (this.firecrawl.isRecentlyFailed(slug)) {
      this.logger.log(`Pulando descoberta de slug=${slug} (falhou recentemente)`);
      return null;
    }

    const country = input.country?.trim() ?? '';
    const city = input.city?.trim() ?? '';
    const [firecrawl, llm] = await Promise.all([this.firecrawl.discover(query, country, input.region ?? ''), this.ai.enrich(query, country, city)]);
    const merged = mergeDiscovery(firecrawl, llm, { query, country, city });
    if (!merged.hasData) {
      this.logger.log(`Descoberta sem dados uteis para slug=${slug}`);
      this.firecrawl.markRecentlyFailed(slug);
      return null;
    }

    const destinationId = await this.persist(slug, merged, input.region ?? '', input.actorId ?? null);
    this.logger.log(`Destino descoberto: slug=${slug} pois=${merged.pois.length} fontes=${JSON.stringify(merged.sources)}`);
    return destinationId;
  }

  /** Reaproveitado pelo POST /api/firecrawl/ingest (admin). */
  async ingest(destinationId: number, extraction: AggregatedExtraction): Promise<{ poiCount: number; costProfileUpdated: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const destination = await manager.findOneOrFail(Destination, { where: { id: destinationId } });
      this.applyExtraction(destination, extraction.meta, cleanImageUrl(extraction.meta.hero_image_url));
      destination.metadata = {
        ...(destination.metadata ?? {}),
        source_urls: extraction.sourceUrls,
        extracted: extraction.meta,
        scrape_failures: extraction.failures,
      };
      const saved = await manager.save(destination);
      const costProfileUpdated = await this.saveCosts(manager, saved, extraction.costs, extraction.sourceUrls[0] ?? '');
      const poiCount = await this.savePois(manager, saved, extraction.pois);
      return { poiCount, costProfileUpdated };
    });
  }

  private async persist(slug: string, merged: MergedDiscovery, region: string, actorId: number | null): Promise<number> {
    const existing = await this.dataSource.getRepository(Destination).findOne({ where: { slug } });
    // Rede fora da transacao. A foto da Wikipedia (desambiguada pela regiao) e mais confiavel que a
    // escolhida pela extracao do Firecrawl, que so entra se a URL for uma imagem acessivel.
    let hero = '';
    if (!existing?.hero_image_url) {
      const hints = { region, country: merged.country === 'Desconhecido' ? '' : merged.country };
      hero = await fetchWikipediaThumbnail(existing?.name ?? merged.name, hints);
      if (!hero && existing && existing.name !== merged.name) hero = await fetchWikipediaThumbnail(merged.name, hints);
      if (!hero && merged.heroImageUrl && (await isReachableImage(merged.heroImageUrl))) hero = merged.heroImageUrl;
    }
    const poiImages = await filterReachableImages(merged.pois.map((poi) => cleanImageUrl(poi.image_url)));
    const pois = merged.pois.map((poi) => (poiImages.has(cleanImageUrl(poi.image_url)) ? poi : { ...poi, image_url: undefined }));

    return this.dataSource.transaction(async (manager) => {
      const destination =
        (await manager.findOne(Destination, { where: { slug } })) ??
        manager.create(Destination, {
          slug,
          name: merged.name.slice(0, 150),
          country: merged.country.slice(0, 100),
          city: merged.city.slice(0, 100),
          summary: '',
          hero_image_url: '',
          created_by: actorId ? ({ id: actorId } as never) : null,
        });

      this.applyExtraction(destination, merged.extractedMeta, hero);
      // Campos que so o LLM trouxe entram quando ainda estao vazios.
      if (merged.summary && !destination.summary) destination.summary = merged.summary.slice(0, 4000);
      if (merged.bestSeason && !destination.best_season) destination.best_season = merged.bestSeason.slice(0, 120);
      if (merged.timezone && !destination.timezone) destination.timezone = merged.timezone.slice(0, 64);
      if (destination.country === 'Desconhecido' && merged.country !== 'Desconhecido') destination.country = merged.country.slice(0, 100);
      if (!destination.city && merged.city) destination.city = merged.city.slice(0, 100);
      destination.metadata = {
        ...(destination.metadata ?? {}),
        source_urls: merged.sourceUrls,
        extracted: merged.extractedMeta,
        scrape_failures: merged.scrapeFailures,
        sources: merged.sources,
        ...(region ? { region } : {}),
        ...(merged.llmModel ? { llm_model: merged.llmModel } : {}),
        ...(merged.llmSource ? { llm_source: merged.llmSource } : {}),
      };

      const saved = await manager.save(destination);
      await this.saveCosts(manager, saved, merged.costs, merged.sourceUrls[0] ?? '');
      await this.savePois(manager, saved, pois);
      return Number(saved.id);
    });
  }

  private applyExtraction(destination: Destination, meta: Record<string, unknown>, hero: string): void {
    const text = (key: string) => (typeof meta[key] === 'string' ? (meta[key] as string).trim() : '');
    if (text('summary')) destination.summary = text('summary').slice(0, 4000);
    if (text('best_season')) destination.best_season = text('best_season').slice(0, 120);
    if (text('timezone')) destination.timezone = text('timezone').slice(0, 64);
    if (hero && !destination.hero_image_url) destination.hero_image_url = hero;
  }

  private async saveCosts(manager: EntityManager, destination: Destination, costs: ExtractedCosts | null, sourceUrl: string): Promise<boolean> {
    if (!hasAllCosts(costs)) return false;
    const profile =
      (await manager.findOne(DestinationCostProfile, { where: { destination: { id: destination.id } } })) ??
      manager.create(DestinationCostProfile, { destination: { id: destination.id } as Destination, notes: '' });
    profile.currency_code = 'BRL';
    profile.daily_budget_low = Number(costs.low).toFixed(2);
    profile.daily_budget_mid = Number(costs.mid).toFixed(2);
    profile.daily_budget_high = Number(costs.high).toFixed(2);
    profile.source_url = cleanUrl(sourceUrl, 200);
    await manager.save(profile);
    return true;
  }

  private async savePois(manager: EntityManager, destination: Destination, pois: DiscoveryPoi[]): Promise<number> {
    let count = 0;
    for (const data of pois) {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      const slug = slugify(name);
      if (!name || !slug) continue;

      const poi =
        (await manager.findOne(PointOfInterest, { where: { destination: { id: destination.id }, slug } })) ??
        manager.create(PointOfInterest, { destination: { id: destination.id } as Destination, slug });
      const metadata = { ...(poi.metadata ?? {}) };
      const imageUrl = cleanImageUrl(data.image_url);
      if (imageUrl) metadata.image_url = imageUrl;
      if (data.source) metadata.source = String(data.source).slice(0, 32);
      poi.name = name.slice(0, 160);
      poi.poi_type = normalizePoiType(data.type);
      poi.summary = (typeof data.summary === 'string' ? data.summary : '').slice(0, 4000);
      poi.source_url = cleanUrl(data.source_url, 200);
      poi.metadata = metadata;

      const tags = await this.resolveTags(manager, data.tags);
      if (tags.length > 0) poi.tags = tags;
      await manager.save(poi);
      count += 1;
    }
    return count;
  }

  private async resolveTags(manager: EntityManager, raw: unknown): Promise<PoiTag[]> {
    const names = Array.isArray(raw) ? raw.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0) : [];
    const tags = new Map<string, PoiTag>();
    for (const tagName of names) {
      const slug = slugify(tagName.trim());
      if (!slug || tags.has(slug)) continue;
      const name = titleCase(tagName).slice(0, 80);
      const tag =
        (await manager.findOne(PoiTag, { where: [{ slug }, { name }] })) ??
        (await manager.save(manager.create(PoiTag, { slug, name })));
      tags.set(slug, tag);
    }
    return [...tags.values()];
  }
}
