import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { AgentEntity } from '../agents/agent.entity.js';
import { RegionEntity } from '../regions/region.entity.js';

@Entity({ name: 'agent_positions' })
@Index('uq_agent_positions_agent', ['agentId'], { unique: true })
export class AgentPositionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string;

  @OneToOne(() => AgentEntity, (agent) => agent.position, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Relation<AgentEntity>;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ name: 'region_id', type: 'uuid', nullable: true })
  regionId!: string | null;

  @ManyToOne(() => RegionEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'region_id' })
  region!: Relation<RegionEntity> | null;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
