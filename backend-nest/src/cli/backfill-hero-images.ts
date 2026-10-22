import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { Destination } from '../modules/destinations/entities';
import { fetchWikipediaThumbnail } from '../modules/destinations/discovery/wikipedia';

/**
 * Preenche `hero_image_url` vazio buscando a foto na Wikipedia (equivalente ao comando
 * `backfill_hero_images` do Django). Uso: npm run backfill:hero-images -- [--force] [--limit N] [--delay S]
 */
function option(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(process.argv[index + 1]) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

async function main() {
  const force = process.argv.includes('--force');
  const limit = option('limit', 0);
  const delayMs = option('delay', 0.5) * 1000;
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const destinations = app.get<Repository<Destination>>(getRepositoryToken(Destination));
    const targets = await destinations.find({
      where: force ? {} : { hero_image_url: '' },
      order: { slug: 'ASC' },
      ...(limit > 0 ? { take: limit } : {}),
    });
    console.log(`Backfill de hero_image_url para ${targets.length} destino(s) (force=${force})`);
    let filled = 0;
    for (const [index, destination] of targets.entries()) {
      const prefix = `[${index + 1}/${targets.length}] ${destination.slug}`;
      const region = typeof destination.metadata?.region === 'string' ? destination.metadata.region : '';
      const country = destination.country === 'Desconhecido' ? '' : destination.country;
      const url = await fetchWikipediaThumbnail(destination.name, { region, country });
      if (url) {
        await destinations.update({ id: destination.id }, { hero_image_url: url });
        filled += 1;
        console.log(`${prefix} -> ok (${url.slice(0, 80)}...)`);
      } else {
        console.warn(`${prefix} -> Wikipedia sem foto`);
      }
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    console.log(`Resumo: ${filled} preenchido(s), ${targets.length - filled} sem foto.`);
  } finally {
    await app.close();
  }
}

void main();
