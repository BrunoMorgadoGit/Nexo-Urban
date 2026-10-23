import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  MonitoringAlertCode,
  MonitoringAlertResourceType,
  MonitoringAlertSeverity,
  MonitoringAlertStatus,
} from '@fogo/contracts';

@Entity({ name: 'operational_alerts' })
@Index('uq_operational_alerts_active_fingerprint', ['fingerprint'], { unique: true, where: '"resolved_at" IS NULL' })
@Index('idx_operational_alerts_status_severity_created', ['status', 'severity', 'createdAt'])
@Index('idx_operational_alerts_resource', ['resourceType', 'resourceId', 'status'])
export class OperationalAlertEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 180 })
  fingerprint!: string;

  @Column({ type: 'varchar', length: 40 })
  code!: MonitoringAlertCode;

  @Column({ type: 'varchar', length: 12 })
  severity!: MonitoringAlertSeverity;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status!: MonitoringAlertStatus;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'varchar', length: 500 })
  description!: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 16 })
  resourceType!: MonitoringAlertResourceType;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId!: string;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt!: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
