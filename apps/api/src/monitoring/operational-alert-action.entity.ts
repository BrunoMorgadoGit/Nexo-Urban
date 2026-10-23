import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import type { MonitoringAlertActionType } from '@fogo/contracts';
import { OperationalAlertEntity } from './operational-alert.entity.js';

@Entity({ name: 'operational_alert_actions' })
@Index('idx_operational_alert_actions_alert_created', ['alertId', 'createdAt'])
export class OperationalAlertActionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'alert_id', type: 'uuid' })
  alertId!: string;

  @ManyToOne(() => OperationalAlertEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alert_id' })
  alert!: Relation<OperationalAlertEntity>;

  @Column({ type: 'varchar', length: 16 })
  type!: MonitoringAlertActionType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @Column({ type: 'varchar', length: 100 })
  actor!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
