import { Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, Relation, Unique, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { ItineraryDailyEvent, Itinerary } from '../itineraries/entities';
import { LlmJob } from '../ai/entities';

@Entity('destinations_destination')
export class Destination {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  country!: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  city!: string;

  @Column({ type: 'text', default: '' })
  summary!: string;

  @Column({ name: 'hero_image_url', type: 'varchar', length: 200, default: '' })
  hero_image_url!: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  timezone!: string;

  @Column({ name: 'best_season', type: 'varchar', length: 120, default: '' })
  best_season!: string;

  @Column({ name: 'average_rating', type: 'decimal', precision: 3, scale: 2, default: 0 })
  average_rating!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  created_by!: Relation<User> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;

  @OneToOne(() => DestinationCostProfile, (profile) => profile.destination)
  cost_profile!: Relation<DestinationCostProfile>;

  @OneToMany(() => PointOfInterest, (poi) => poi.destination)
  pois!: Relation<PointOfInterest[]>;

  @OneToMany(() => Itinerary, (itinerary) => itinerary.destination)
  itineraries!: Relation<Itinerary[]>;

  @OneToMany(() => LlmJob, (job) => job.destination)
  llm_jobs!: Relation<LlmJob[]>;
}

@Entity('destinations_destinationcostprofile')
export class DestinationCostProfile {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @OneToOne(() => Destination, (destination) => destination.cost_profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination!: Relation<Destination>;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'BRL' })
  currency_code!: string;

  @Column({ name: 'daily_budget_low', type: 'decimal', precision: 10, scale: 2 })
  daily_budget_low!: string;

  @Column({ name: 'daily_budget_mid', type: 'decimal', precision: 10, scale: 2 })
  daily_budget_mid!: string;

  @Column({ name: 'daily_budget_high', type: 'decimal', precision: 10, scale: 2 })
  daily_budget_high!: string;

  @Column({ name: 'source_url', type: 'varchar', length: 200, default: '' })
  source_url!: string;

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('destinations_poitag')
export class PoiTag {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 80, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  slug!: string;

  @ManyToMany(() => PointOfInterest, (poi) => poi.tags)
  pois!: Relation<PointOfInterest[]>;
}

@Entity('destinations_pointofinterest')
@Unique(['destination', 'slug'])
export class PointOfInterest {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @ManyToOne(() => Destination, (destination) => destination.pois, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination!: Relation<Destination>;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  slug!: string;

  @Column({ name: 'poi_type', type: 'varchar', length: 24 })
  poi_type!: string;

  @Column({ type: 'text', default: '' })
  summary!: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  address!: string;

  @Column({ name: 'opening_hours', type: 'varchar', length: 255, default: '' })
  opening_hours!: string;

  @Column({ name: 'source_url', type: 'varchar', length: 200, default: '' })
  source_url!: string;

  @Column({ name: 'price_level', type: 'smallint', default: 1 })
  price_level!: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating!: string;

  @Column({ name: 'estimated_visit_minutes', type: 'integer', default: 90 })
  estimated_visit_minutes!: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @ManyToMany(() => PoiTag, (tag) => tag.pois)
  @JoinTable({
    name: 'destinations_pointofinterest_tags',
    joinColumn: { name: 'pointofinterest_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'poitag_id', referencedColumnName: 'id' },
  })
  tags!: Relation<PoiTag[]>;

  @OneToMany(() => ItineraryDailyEvent, (event) => event.poi)
  daily_events!: Relation<ItineraryDailyEvent[]>;
}
