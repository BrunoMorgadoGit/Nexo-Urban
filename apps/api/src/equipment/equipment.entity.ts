import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { EquipmentStatus, MaintenancePriority } from '@fogo/contracts';
import { EquipmentTypeEntity } from '../equipment-types/equipment-type.entity.js';
import { OrganizationEntity } from '../organizations/organization.entity.js';
import { EquipmentLocationEntity } from '../locations/equipment-location.entity.js';
import { EquipmentPositionEntity } from '../locations/equipment-position.entity.js';
import { MaintenanceEntity } from '../maintenance/maintenance.entity.js';

@Entity({ name: 'equipment' })
@Index('uq_equipment_serial_number', ['serialNumber'], { unique: true })
@Index('idx_equipment_status_type', ['status', 'typeCode'])
@Index('idx_equipment_organization', ['organizationId'])
export class EquipmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'type_code', type: 'varchar', length: 60 })
  typeCode!: string;

  @ManyToOne(() => EquipmentTypeEntity, { nullable: false })
  @JoinColumn({ name: 'type_code', referencedColumnName: 'code' })
  type!: Relation<EquipmentTypeEntity>;

  @Column({ name: 'serial_number', type: 'varchar', length: 80 })
  serialNumber!: string;

  @Column({ type: 'varchar', length: 80 })
  brand!: string;

  @Column({ type: 'varchar', length: 100 })
  model!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { nullable: false })
  @JoinColumn({ name: 'organization_id' })
  organization!: Relation<OrganizationEntity>;

  @Column({ type: 'varchar', length: 30 })
  status!: EquipmentStatus;

  @Column({ name: 'maintenance_priority', type: 'varchar', length: 20 })
  maintenancePriority!: MaintenancePriority;

  @Column({ name: 'next_maintenance_date', type: 'date', nullable: true })
  nextMaintenanceDate!: string | null;

  @Column({ type: 'jsonb' })
  characteristics!: Record<string, string | number | boolean>;

  @Column({ name: 'data_origin', type: 'varchar', length: 12, default: 'manual' })
  dataOrigin!: 'manual' | 'demo';

  @OneToOne(() => EquipmentLocationEntity, (location) => location.equipment)
  location!: Relation<EquipmentLocationEntity>;

  @OneToOne(() => EquipmentPositionEntity, (position) => position.equipment)
  lastPosition!: Relation<EquipmentPositionEntity> | null;

  @OneToMany(() => MaintenanceEntity, (maintenance) => maintenance.equipment)
  maintenances!: Relation<MaintenanceEntity[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
