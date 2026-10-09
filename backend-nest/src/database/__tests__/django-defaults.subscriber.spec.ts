import { DataSource } from 'typeorm';
import { applyDjangoDefaults, resolveColumnDefault } from '../django-defaults.subscriber';
import { User } from '../../modules/users/user.entity';
import { RefreshToken } from '../../modules/users/refresh-token.entity';
import { TravelerDnaProfile, UserTripPreference } from '../../modules/profiles/entities';
import {
  FavoriteItinerary,
  Itinerary,
  ItineraryDailyEvent,
  ItineraryDay,
  Review,
  ReviewStat,
  SharedItineraryLink,
} from '../../modules/itineraries/entities';
import { Destination, DestinationCostProfile, PoiTag, PointOfInterest } from '../../modules/destinations/entities';
import { AuditLog } from '../../modules/audit/audit-log.entity';
import { LlmJob, LlmJobLog, LlmModel, LlmProvider, PromptTemplate } from '../../modules/ai/entities';

const ENTITIES = [
  User, RefreshToken, TravelerDnaProfile, UserTripPreference, Itinerary, ItineraryDay, ItineraryDailyEvent,
  FavoriteItinerary, Review, ReviewStat, SharedItineraryLink, Destination, DestinationCostProfile, PoiTag,
  PointOfInterest, AuditLog, LlmProvider, LlmModel, PromptTemplate, LlmJob, LlmJobLog,
];

describe('resolveColumnDefault', () => {
  const now = new Date('2026-10-08T12:00:00.000Z');

  it('usa o instante informado para colunas de data de criacao/atualizacao', () => {
    expect(resolveColumnDefault({ default: undefined, isCreateDate: true, isUpdateDate: false }, now)).toEqual(now);
    expect(resolveColumnDefault({ default: undefined, isCreateDate: false, isUpdateDate: true }, now)).toEqual(now);
  });

  it('converte defaults SQL declarados como funcao', () => {
    expect(resolveColumnDefault({ default: () => "'{}'", isCreateDate: false, isUpdateDate: false }, now)).toEqual({});
    expect(resolveColumnDefault({ default: () => "'[]'", isCreateDate: false, isUpdateDate: false }, now)).toEqual([]);
    expect(resolveColumnDefault({ default: () => 'CURRENT_TIMESTAMP', isCreateDate: false, isUpdateDate: false }, now)).toEqual(now);
  });

  it('devolve literais como estao e undefined quando nao ha default', () => {
    expect(resolveColumnDefault({ default: '', isCreateDate: false, isUpdateDate: false }, now)).toBe('');
    expect(resolveColumnDefault({ default: 'BRL', isCreateDate: false, isUpdateDate: false }, now)).toBe('BRL');
    expect(resolveColumnDefault({ default: 0, isCreateDate: false, isUpdateDate: false }, now)).toBe(0);
    expect(resolveColumnDefault({ default: false, isCreateDate: false, isUpdateDate: false }, now)).toBe(false);
    expect(resolveColumnDefault({ default: undefined, isCreateDate: false, isUpdateDate: false }, now)).toBeUndefined();
  });
});

describe('applyDjangoDefaults com metadata real das entities', () => {
  const dataSource = new DataSource({ type: 'postgres', entities: ENTITIES });

  beforeAll(async () => {
    // buildMetadatas monta a metadata sem abrir conexao com o banco.
    await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  });

  it('preenche todos os defaults do usuario sem tocar no que foi informado', () => {
    const user = Object.assign(new User(), { email: 'a@b.dev', username: 'a', password: 'x', preferred_currency: 'EUR' });
    const now = new Date('2026-10-08T12:00:00.000Z');

    applyDjangoDefaults(dataSource.getMetadata(User).columns, user, now);

    expect(user.date_joined).toEqual(now);
    expect(user.created_at).toEqual(now);
    expect(user.updated_at).toEqual(now);
    expect(user.avatar_url).toBe('');
    expect(user.home_airport).toBe('');
    expect(user.display_name).toBe('');
    expect(user.is_profile_complete).toBe(false);
    expect(user.is_active).toBe(true);
    expect(user.preferred_currency).toBe('EUR');
    expect(user.last_login).toBeUndefined();
    expect(user.id).toBeUndefined();
  });

  it('cria objetos json independentes e ignora colunas de relacao', () => {
    const first = new Itinerary();
    const second = new Itinerary();
    const columns = dataSource.getMetadata(Itinerary).columns;

    applyDjangoDefaults(columns, first);
    applyDjangoDefaults(columns, second);

    expect(first.metadata).toEqual({});
    expect(first.generation_context).toEqual({});
    expect(first.metadata).not.toBe(second.metadata);
    expect(first.generation_status).toBe('draft');
    expect(first.user).toBeUndefined();
    expect(first.destination).toBeUndefined();
  });
});
