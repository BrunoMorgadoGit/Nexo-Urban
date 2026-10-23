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

@Entity({ name: 'agents' })
@Index('uq_agents_identifier', ['identifier'], { unique: true })
@Index('idx_agents_organization_availability', ['organizationId', 'availability'])
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

  @OneToOne(() => AgentPositionEntity, (position) => position.agent)
  position!: Relation<AgentPositionEntity> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
