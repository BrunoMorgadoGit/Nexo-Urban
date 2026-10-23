import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { MaintenancePriority } from '@fogo/contracts';
import { EquipmentEntity } from '../equipment/equipment.entity.js';

export type MaintenanceKind = 'immediate' | 'scheduled' | 'periodic';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

@Entity({ name: 'maintenances' })
@Index('idx_maintenances_status_date', ['status', 'scheduledDate'])
@Index('idx_maintenances_equipment', ['equipmentId', 'scheduledDate'])
export class MaintenanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'equipment_id', type: 'uuid' })
  equipmentId!: string;

  @ManyToOne(() => EquipmentEntity, (equipment) => equipment.maintenances, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment!: Relation<EquipmentEntity>;

  @Column({ type: 'varchar', length: 20 })
  kind!: MaintenanceKind;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status!: MaintenanceStatus;

  @Column({ type: 'varchar', length: 20 })
  priority!: MaintenancePriority;

  @Column({ type: 'varchar', length: 500 })
  description!: string;

  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate!: string;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
