import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, Relation, Unique, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Destination, PointOfInterest } from '../destinations/entities';
import { LlmJob } from '../ai/entities';

@Entity('itineraries_itinerary')
export class Itinerary {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @ManyToOne(() => User, (user) => user.itineraries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => Destination, (destination) => destination.itineraries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination!: Relation<Destination>;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text', default: '' })
  summary!: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  start_date!: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  end_date!: string | null;

  @Column({ name: 'duration_days', type: 'integer' })
  duration_days!: number;

  @Column({ name: 'budget_total', type: 'decimal', precision: 10, scale: 2, default: 0 })
  budget_total!: string;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'BRL' })
  currency_code!: string;

  @Column({ name: 'generation_status', type: 'varchar', length: 24, default: 'draft' })
  generation_status!: string;

  @Column({ name: 'generation_context', type: 'jsonb', default: () => "'{}'" })
  generation_context!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;

  @OneToMany(() => ItineraryDay, (day) => day.itinerary)
  days!: Relation<ItineraryDay[]>;

  @OneToMany(() => FavoriteItinerary, (favorite) => favorite.itinerary)
  favorites!: Relation<FavoriteItinerary[]>;

  @OneToMany(() => Review, (review) => review.itinerary)
  reviews!: Relation<Review[]>;

  @OneToOne(() => ReviewStat, (stat) => stat.itinerary)
  review_stats!: Relation<ReviewStat>;

  @OneToMany(() => SharedItineraryLink, (link) => link.itinerary)
  shared_links!: Relation<SharedItineraryLink[]>;

  @OneToMany(() => LlmJob, (job) => job.itinerary)
  llm_jobs!: Relation<LlmJob[]>;
}

@Entity('itineraries_itineraryday')
@Unique(['itinerary', 'day_number'])
export class ItineraryDay {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @ManyToOne(() => Itinerary, (itinerary) => itinerary.days, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itinerary_id' })
  itinerary!: Relation<Itinerary>;

  @Column({ name: 'day_number', type: 'integer' })
  day_number!: number;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'text', default: '' })
  summary!: string;

  @Column({ name: 'estimated_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  estimated_cost!: string;

  @OneToMany(() => ItineraryDailyEvent, (event) => event.itinerary_day)
  events!: Relation<ItineraryDailyEvent[]>;
}

@Entity('itineraries_itinerarydailyevent')
export class ItineraryDailyEvent {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @ManyToOne(() => ItineraryDay, (day) => day.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itinerary_day_id' })
  itinerary_day!: Relation<ItineraryDay>;

  @ManyToOne(() => PointOfInterest, (poi) => poi.daily_events, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<PointOfInterest> | null;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  start_time!: string | null;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  end_time!: string | null;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ name: 'estimated_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  estimated_cost!: string;

  @Column({ name: 'order_index', type: 'integer', default: 0 })
  order_index!: number;
}

@Entity('itineraries_favoriteitinerary')
@Unique(['user', 'itinerary'])
export class FavoriteItinerary {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @ManyToOne(() => User, (user) => user.favorite_itineraries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => Itinerary, (itinerary) => itinerary.favorites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itinerary_id' })
  itinerary!: Relation<Itinerary>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}

@Entity('itineraries_review')
@Unique(['itinerary', 'user'])
export class Review {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @ManyToOne(() => Itinerary, (itinerary) => itinerary.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itinerary_id' })
  itinerary!: Relation<Itinerary>;

  @ManyToOne(() => User, (user) => user.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Column({ type: 'smallint' })
  rating!: number;

  @Column({ type: 'varchar', length: 120, default: '' })
  title!: string;

  @Column({ type: 'text', default: '' })
  body!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;
}

@Entity('itineraries_reviewstat')
export class ReviewStat {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @OneToOne(() => Itinerary, (itinerary) => itinerary.review_stats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itinerary_id' })
  itinerary!: Relation<Itinerary>;

  @Column({ name: 'review_count', type: 'integer', default: 0 })
  review_count!: number;

  @Column({ name: 'average_rating', type: 'decimal', precision: 3, scale: 2, default: 0 })
  average_rating!: string;
}

@Entity('itineraries_shareditinerarylink')
export class SharedItineraryLink {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @ManyToOne(() => Itinerary, (itinerary) => itinerary.shared_links, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itinerary_id' })
  itinerary!: Relation<Itinerary>;

  @ManyToOne(() => User, (user) => user.shared_itineraries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_id' })
  created_by!: Relation<User>;

  @Column({ type: 'uuid', unique: true })
  token!: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expires_at!: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}
