import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { RegionEntity } from '../regions/region.entity.js';
import { IntelligenceDatasetEntity } from './intelligence-dataset.entity.js';

export type IntelligenceHistoryEventType = 'status_observation' | 'failure' | 'maintenance_due' | 'maintenance_completed';

@Entity({ name: 'intelligence_history_events' })
@Index('idx_intelligence_history_region_date', ['regionId', 'occurredAt'])
@Index('idx_intelligence_history_equipment_date', ['equipmentId', 'occurredAt'])
@Index('idx_intelligence_history_dataset_type_date', ['datasetKey', 'eventType', 'occurredAt'])
export class IntelligenceHistoryEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'dataset_key', type: 'varchar', length: 80 })
  datasetKey!: string;

  @ManyToOne(() => IntelligenceDatasetEntity, (dataset) => dataset.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dataset_key' })
  dataset!: Relation<IntelligenceDatasetEntity>;

  @Column({ name: 'event_key', type: 'varchar', length: 180, unique: true })
  eventKey!: string;

  @Column({ name: 'equipment_id', type: 'uuid' })
  equipmentId!: string;

  @ManyToOne(() => EquipmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment!: Relation<EquipmentEntity>;

  @Column({ name: 'region_id', type: 'uuid' })
  regionId!: string;

  @ManyToOne(() => RegionEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'region_id' })
  region!: Relation<RegionEntity>;

  @Column({ name: 'event_type', type: 'varchar', length: 32 })
  eventType!: IntelligenceHistoryEventType;

  @Column({ type: 'varchar', length: 12, nullable: true })
  severity!: 'low' | 'medium' | 'high' | 'critical' | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ type: 'jsonb' })
  details!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16, default: 'synthetic' })
  origin!: 'synthetic';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
