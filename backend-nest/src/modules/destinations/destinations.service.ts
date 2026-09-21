import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Destination, PointOfInterest } from './entities';
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
    if (!destination) throw new NotFoundException('Destination not found.');
    return destination;
  }

  async search(input: { q?: string; country?: string; city?: string }): Promise<Destination[]> {
    const q = input.q?.trim();
    const where = q
      ? [
          { name: ILike(`%${q}%`) },
          { country: ILike(`%${q}%`) },
          { city: ILike(`%${q}%`) },
          { summary: ILike(`%${q}%`) },
        ]
      : {};
    let results = await this.destinations.find({
      where,
      relations: { cost_profile: true, pois: { tags: true } },
      order: { average_rating: 'DESC', name: 'ASC' },
      take: 20,
    });
    if (input.country) results = results.filter((item) => item.country.toLowerCase() === input.country?.toLowerCase());
    if (input.city) results = results.filter((item) => item.city.toLowerCase() === input.city?.toLowerCase());
    return results;
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
