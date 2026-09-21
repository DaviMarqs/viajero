import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TravelerDnaProfile, UserTripPreference } from './entities';
import { TravelerDnaDto } from './dto/traveler-dna.dto';
import { TripPreferenceDto } from './dto/trip-preference.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(TravelerDnaProfile) private readonly dnaProfiles: Repository<TravelerDnaProfile>,
    @InjectRepository(UserTripPreference) private readonly tripPreferences: Repository<UserTripPreference>,
    private readonly audit: AuditService,
  ) {}

  getDna(userId: number): Promise<TravelerDnaProfile | null> {
    return this.dnaProfiles.findOne({ where: { user: { id: userId } } });
  }

  async upsertDna(userId: number, dto: Partial<TravelerDnaDto>): Promise<TravelerDnaProfile> {
    const current = await this.getDna(userId);
    const profile = this.dnaProfiles.create({ ...(current ?? {}), ...dto, user: { id: userId } as never, notes: dto.notes ?? current?.notes ?? '' });
    const saved = await this.dnaProfiles.save(profile);
    await this.audit.log({ event_type: `traveler-dna.${current ? 'updated' : 'created'}`, actor_id: userId, content_type: 'TravelerDnaProfile', object_id: String(saved.id) });
    return saved;
  }

  getTripPreference(userId: number): Promise<UserTripPreference | null> {
    return this.tripPreferences.findOne({ where: { user: { id: userId } } });
  }

  async upsertTripPreference(userId: number, dto: Partial<TripPreferenceDto>): Promise<UserTripPreference> {
    const min = dto.budget_min;
    const max = dto.budget_max;
    if (min !== undefined && max !== undefined && Number(min) > Number(max)) {
      throw new BadRequestException('budget_min cannot exceed budget_max');
    }
    const current = await this.getTripPreference(userId);
    const preference = this.tripPreferences.create({
      ...(current ?? {}),
      ...dto,
      budget_min: dto.budget_min !== undefined ? String(dto.budget_min) : current?.budget_min,
      budget_max: dto.budget_max !== undefined ? String(dto.budget_max) : current?.budget_max,
      user: { id: userId } as never,
      companionship: dto.companionship ?? current?.companionship ?? '',
      travel_month: dto.travel_month ?? current?.travel_month ?? '',
      hotel_level: dto.hotel_level ?? current?.hotel_level ?? '',
      transportation_style: dto.transportation_style ?? current?.transportation_style ?? '',
      dietary_preferences: dto.dietary_preferences ?? current?.dietary_preferences ?? [],
      accessibility_needs: dto.accessibility_needs ?? current?.accessibility_needs ?? [],
      interests: dto.interests ?? current?.interests ?? [],
      metadata: dto.metadata ?? current?.metadata ?? {},
    });
    const saved = await this.tripPreferences.save(preference);
    await this.audit.log({ event_type: `trip-preferences.${current ? 'updated' : 'created'}`, actor_id: userId, content_type: 'UserTripPreference', object_id: String(saved.id) });
    return saved;
  }
}
