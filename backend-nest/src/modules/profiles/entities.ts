import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('profiles_travelerdnaprofile')
export class TravelerDnaProfile {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @OneToOne(() => User, (user) => user.traveler_dna_profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Column({ name: 'travel_style', type: 'varchar', length: 80 })
  travel_style!: string;

  @Column({ type: 'varchar', length: 40 })
  pace!: string;

  @Column({ name: 'comfort_level', type: 'varchar', length: 40 })
  comfort_level!: string;

  @Column({ name: 'social_energy', type: 'smallint' })
  social_energy!: number;

  @Column({ name: 'adventure_level', type: 'smallint' })
  adventure_level!: number;

  @Column({ name: 'food_focus', type: 'smallint' })
  food_focus!: number;

  @Column({ name: 'cultural_interest', type: 'smallint' })
  cultural_interest!: number;

  @Column({ name: 'nature_interest', type: 'smallint' })
  nature_interest!: number;

  @Column({ name: 'nightlife_interest', type: 'smallint' })
  nightlife_interest!: number;

  @Column({ type: 'text', default: '' })
  notes!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;
}

@Entity('profiles_usertrippreference')
export class UserTripPreference {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @OneToOne(() => User, (user) => user.trip_preference, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Column({ name: 'budget_min', type: 'decimal', precision: 10, scale: 2 })
  budget_min!: string;

  @Column({ name: 'budget_max', type: 'decimal', precision: 10, scale: 2 })
  budget_max!: string;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'BRL' })
  currency_code!: string;

  @Column({ type: 'varchar', length: 40, default: '' })
  companionship!: string;

  @Column({ name: 'preferred_trip_length_days', type: 'integer' })
  preferred_trip_length_days!: number;

  @Column({ name: 'travel_month', type: 'varchar', length: 20, default: '' })
  travel_month!: string;

  @Column({ name: 'hotel_level', type: 'varchar', length: 40, default: '' })
  hotel_level!: string;

  @Column({ name: 'transportation_style', type: 'varchar', length: 40, default: '' })
  transportation_style!: string;

  @Column({ name: 'dietary_preferences', type: 'jsonb', default: () => "'[]'" })
  dietary_preferences!: string[];

  @Column({ name: 'accessibility_needs', type: 'jsonb', default: () => "'[]'" })
  accessibility_needs!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  interests!: string[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;
}
