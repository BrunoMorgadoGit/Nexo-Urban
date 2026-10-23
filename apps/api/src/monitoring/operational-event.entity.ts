import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { OperationalEventType } from '@fogo/contracts';

@Entity({ name: 'operational_events' })
@Index('idx_operational_events_created_at', ['createdAt'])
@Index('idx_operational_events_resource', ['resourceType', 'resourceId', 'id'])
export class OperationalEventEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType!: OperationalEventType;

  @Column({ name: 'resource_type', type: 'varchar', length: 24 })
  resourceType!: 'equipment' | 'agent' | 'maintenance' | 'alert' | 'demo_scenario';

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16, default: 'api' })
  source!: 'api' | 'demo';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
