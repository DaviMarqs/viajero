import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TravelerDnaProfile, UserTripPreference } from './entities';
import { UpdateTravelerDnaDto } from './dto/update-traveler-dna.dto';
import { UpdateTripPreferenceDto } from './dto/update-trip-preference.dto';
import { AuditService } from '../audit/audit.service';
import { User } from '../users/user.entity';

const REQUIRED_DNA_FIELDS = [
  'travel_style',
  'pace',
  'comfort_level',
  'social_energy',
  'adventure_level',
  'food_focus',
  'cultural_interest',
  'nature_interest',
  'nightlife_interest',
] as const;
const REQUIRED_TRIP_FIELDS = ['budget_min', 'budget_max', 'preferred_trip_length_days'] as const;

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(TravelerDnaProfile) private readonly dnaProfiles: Repository<TravelerDnaProfile>,
    @InjectRepository(UserTripPreference) private readonly tripPreferences: Repository<UserTripPreference>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  getDna(userId: number): Promise<TravelerDnaProfile | null> {
    return this.dnaProfiles.findOne({ where: { user: { id: userId } } });
  }

  async upsertDna(userId: number, dto: UpdateTravelerDnaDto): Promise<TravelerDnaProfile> {
    const current = await this.getDna(userId);
    if (!current && REQUIRED_DNA_FIELDS.some((field) => dto[field] === undefined)) {
      throw new BadRequestException('Responda todas as etapas do perfil de viajante antes de salvar.');
    }
    const profile = this.dnaProfiles.create({ ...(current ?? {}), ...dto, user: { id: userId } as never, notes: dto.notes ?? current?.notes ?? '' });
    const saved = await this.dnaProfiles.save(profile);
    await this.audit.log({ event_type: `traveler-dna.${current ? 'updated' : 'created'}`, actor_id: userId, content_type: 'TravelerDnaProfile', object_id: String(saved.id) });
    await this.syncProfileCompletion(userId);
    return saved;
  }

  getTripPreference(userId: number): Promise<UserTripPreference | null> {
    return this.tripPreferences.findOne({ where: { user: { id: userId } } });
  }

  async upsertTripPreference(userId: number, dto: UpdateTripPreferenceDto): Promise<UserTripPreference> {
    const current = await this.getTripPreference(userId);
    if (!current && REQUIRED_TRIP_FIELDS.some((field) => dto[field] === undefined)) {
      throw new BadRequestException('Informe orcamento e duracao da viagem antes de salvar.');
    }
    const min = dto.budget_min ?? (current ? Number(current.budget_min) : undefined);
    const max = dto.budget_max ?? (current ? Number(current.budget_max) : undefined);
    if (min !== undefined && max !== undefined && min > max) {
      throw new BadRequestException('O orcamento minimo nao pode ser maior que o maximo.');
    }
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
    await this.syncProfileCompletion(userId);
    return saved;
  }

  /** O front mostra "Perfil incompleto" ate o usuario ter DNA e preferencias. */
  private async syncProfileCompletion(userId: number): Promise<void> {
    const [dna, preference] = await Promise.all([this.getDna(userId), this.getTripPreference(userId)]);
    if (dna && preference) {
      await this.users.update({ id: userId, is_profile_complete: false }, { is_profile_complete: true });
    }
  }
}
