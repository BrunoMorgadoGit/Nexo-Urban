import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { AgentAvailability, AgentCategory } from '@fogo/contracts';
import { OrganizationEntity } from '../organizations/organization.entity.js';
import { AgentPositionEntity } from '../locations/agent-position.entity.js';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { OperationalBaseEntity } from './operational-base.entity.js';

@Entity({ name: 'agents' })
@Index('uq_agents_identifier', ['identifier'], { unique: true })
@Index('idx_agents_organization_availability', ['organizationId', 'availability'])
@Index('idx_agents_equipment', ['equipmentId'])
@Index('idx_agents_operational_base', ['operationalBaseId'])
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 40 })
  identifier!: string;

  @Column({ type: 'varchar', length: 30 })
  category!: AgentCategory;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { nullable: false })
  @JoinColumn({ name: 'organization_id' })
  organization!: Relation<OrganizationEntity>;

  @Column({ type: 'varchar', length: 20 })
  availability!: AgentAvailability;

  @Column({ name: 'operational_base_id', type: 'uuid', nullable: true })
  operationalBaseId!: string | null;

  @ManyToOne(() => OperationalBaseEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operational_base_id' })
  operationalBase!: Relation<OperationalBaseEntity> | null;

  @Column({ name: 'equipment_id', type: 'uuid', nullable: true })
  equipmentId!: string | null;

  @ManyToOne(() => EquipmentEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'equipment_id' })
  linkedEquipment!: Relation<EquipmentEntity> | null;

  @Column({ name: 'operational_notes', type: 'varchar', length: 500, nullable: true })
  operationalNotes!: string | null;

  @Column({ name: 'data_origin', type: 'varchar', length: 12, default: 'manual' })
  dataOrigin!: 'manual' | 'demo';

  @OneToOne(() => AgentPositionEntity, (position) => position.agent)
  position!: Relation<AgentPositionEntity> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
