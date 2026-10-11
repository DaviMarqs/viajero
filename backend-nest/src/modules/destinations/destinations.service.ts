import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Destination, PointOfInterest } from './entities';
import { matchesDestinationQuery, normalizeDestinationText, portugueseCountry, portuguesePlaceName } from './destination-language';
import { CreateDestinationDto } from './dto/create-destination.dto';

@Injectable()
export class DestinationsService {
  constructor(
    @InjectRepository(Destination) private readonly destinations: Repository<Destination>,
    @InjectRepository(PointOfInterest) private readonly pois: Repository<PointOfInterest>,
  ) {}

  list(): Promise<Destination[]> {
    return this.destinations.find({
      relations: { cost_profile: true, pois: { tags: true } },
      order: { name: 'ASC' },
      take: 100,
    });
  }

  async findOne(id: number): Promise<Destination> {
    const destination = await this.destinations.findOne({
      where: { id },
      relations: { cost_profile: true, pois: { tags: true } },
    });
    if (!destination) throw new NotFoundException('Destino nao encontrado.');
    return destination;
  }

  async search(input: { q?: string; country?: string; city?: string }): Promise<Destination[]> {
    // Search original names and Portuguese aliases without accents; never create duplicate cities for a translated query.
    let results = await this.destinations.find({
      relations: { cost_profile: true, pois: { tags: true } },
      order: { average_rating: 'DESC', name: 'ASC' },
    });
    if (input.q?.trim()) results = results.filter(item => matchesDestinationQuery(item, input.q!));
    if (input.country) results = results.filter(item => normalizeDestinationText(portugueseCountry(item.country)) === normalizeDestinationText(portugueseCountry(input.country!)));
    if (input.city) results = results.filter(item => normalizeDestinationText(portuguesePlaceName(item.city)) === normalizeDestinationText(portuguesePlaceName(input.city!)));
    return results.slice(0, 20);
  }

  create(dto: CreateDestinationDto, userId?: number): Promise<Destination> {
    const destination = this.destinations.create({
      ...dto,
      city: dto.city ?? '',
      summary: dto.summary ?? '',
      hero_image_url: dto.hero_image_url ?? '',
      country: dto.country || 'Desconhecido',
      created_by: userId ? ({ id: userId } as never) : null,
    });
    return this.destinations.save(destination);
  }

  listPois(filters: { destination?: number; poi_type?: string }): Promise<PointOfInterest[]> {
    return this.pois.find({
      where: {
        ...(filters.destination ? { destination: { id: filters.destination } } : {}),
        ...(filters.poi_type ? { poi_type: filters.poi_type } : {}),
      },
      relations: { tags: true, destination: true },
      order: { name: 'ASC' },
      take: 100,
    });
  }
}
