import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Destination } from '../destinations/entities';
import { Itinerary } from '../itineraries/entities';

@Entity('ai_llmprovider')
export class LlmProvider {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  key!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  config!: Record<string, unknown>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active!: boolean;

  @OneToMany(() => LlmModel, (model) => model.provider)
  models!: Relation<LlmModel[]>;
}

@Entity('ai_llmmodel')
export class LlmModel {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @ManyToOne(() => LlmProvider, (provider) => provider.models, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider!: Relation<LlmProvider>;

  @Column({ type: 'varchar', length: 50, unique: true })
  key!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'context_window', type: 'integer', default: 16000 })
  context_window!: number;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  is_default!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active!: boolean;
}

@Entity('ai_prompttemplate')
export class PromptTemplate {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  key!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text' })
  template!: string;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;
}

@Entity('ai_llmjob')
export class LlmJob {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @ManyToOne(() => User, (user) => user.llm_jobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => Itinerary, (itinerary) => itinerary.llm_jobs, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'itinerary_id' })
  itinerary!: Relation<Itinerary> | null;

  @ManyToOne(() => Destination, (destination) => destination.llm_jobs, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'destination_id' })
  destination!: Relation<Destination> | null;

  @ManyToOne(() => PromptTemplate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'prompt_template_id' })
  prompt_template!: Relation<PromptTemplate> | null;

  @ManyToOne(() => LlmModel, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'llm_model_id' })
  llm_model!: Relation<LlmModel> | null;

  @Column({ name: 'job_type', type: 'varchar', length: 40, default: 'itinerary_generation' })
  job_type!: string;

  @Column({ type: 'varchar', length: 24, default: 'queued' })
  status!: string;

  @Column({ name: 'request_payload', type: 'jsonb', default: () => "'{}'" })
  request_payload!: Record<string, unknown>;

  @Column({ name: 'response_payload', type: 'jsonb', default: () => "'{}'" })
  response_payload!: Record<string, unknown>;

  @Column({ name: 'error_message', type: 'text', default: '' })
  error_message!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;

  @OneToMany(() => LlmJobLog, (log) => log.llm_job)
  logs!: Relation<LlmJobLog[]>;
}

@Entity('ai_llmjoblog')
export class LlmJobLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @ManyToOne(() => LlmJob, (job) => job.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'llm_job_id' })
  llm_job!: Relation<LlmJob>;

  @Column({ type: 'varchar', length: 16, default: 'info' })
  level!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}
