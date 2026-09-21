import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('audit_auditlog')
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ name: 'event_type', type: 'varchar', length: 80 })
  event_type!: string;

  @ManyToOne(() => User, (user) => user.audit_events, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor!: Relation<User> | null;

  @Column({ name: 'content_type', type: 'varchar', length: 80, default: '' })
  content_type!: string;

  @Column({ name: 'object_id', type: 'varchar', length: 64, default: '' })
  object_id!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}
