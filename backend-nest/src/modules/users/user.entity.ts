import { Column, CreateDateColumn, Entity, OneToMany, OneToOne, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { TravelerDnaProfile, UserTripPreference } from '../profiles/entities';
import { Itinerary, FavoriteItinerary, Review, SharedItineraryLink } from '../itineraries/entities';
import { AuditLog } from '../audit/audit-log.entity';
import { LlmJob } from '../ai/entities';

@Entity('users_user')
export class User {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 128 })
  password!: string;

  @Column({ name: 'last_login', type: 'timestamptz', nullable: true })
  last_login!: Date | null;

  @Column({ name: 'is_superuser', type: 'boolean', default: false })
  is_superuser!: boolean;

  @Column({ type: 'varchar', length: 150, unique: true })
  username!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 150, default: '' })
  first_name!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 150, default: '' })
  last_name!: string;

  @Column({ type: 'varchar', length: 254, unique: true })
  email!: string;

  @Column({ name: 'is_staff', type: 'boolean', default: false })
  is_staff!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ name: 'date_joined', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  date_joined!: Date;

  @Column({ name: 'display_name', type: 'varchar', length: 120, default: '' })
  display_name!: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 200, default: '' })
  avatar_url!: string;

  @Column({ name: 'home_airport', type: 'varchar', length: 12, default: '' })
  home_airport!: string;

  @Column({ name: 'preferred_currency', type: 'varchar', length: 3, default: 'BRL' })
  preferred_currency!: string;

  @Column({ name: 'is_profile_complete', type: 'boolean', default: false })
  is_profile_complete!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refresh_tokens!: Relation<RefreshToken[]>;

  @OneToOne(() => TravelerDnaProfile, (profile) => profile.user)
  traveler_dna_profile!: Relation<TravelerDnaProfile>;

  @OneToOne(() => UserTripPreference, (preference) => preference.user)
  trip_preference!: Relation<UserTripPreference>;

  @OneToMany(() => Itinerary, (itinerary) => itinerary.user)
  itineraries!: Relation<Itinerary[]>;

  @OneToMany(() => FavoriteItinerary, (favorite) => favorite.user)
  favorite_itineraries!: Relation<FavoriteItinerary[]>;

  @OneToMany(() => Review, (review) => review.user)
  reviews!: Relation<Review[]>;

  @OneToMany(() => SharedItineraryLink, (link) => link.created_by)
  shared_itineraries!: Relation<SharedItineraryLink[]>;

  @OneToMany(() => AuditLog, (log) => log.actor)
  audit_events!: Relation<AuditLog[]>;

  @OneToMany(() => LlmJob, (job) => job.user)
  llm_jobs!: Relation<LlmJob[]>;
}
