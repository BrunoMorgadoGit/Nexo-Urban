import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { IntelligenceHistoryEventEntity } from './intelligence-history-event.entity.js';

@Entity({ name: 'intelligence_datasets' })
export class IntelligenceDatasetEntity {
  @PrimaryColumn({ name: 'dataset_key', type: 'varchar', length: 80 })
  datasetKey!: string;

  @Column({ type: 'varchar', length: 24 })
  version!: string;

  @Column({ type: 'varchar', length: 16 })
  origin!: 'synthetic';

  @Column({ name: 'anchor_at', type: 'timestamptz' })
  anchorAt!: Date;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details!: Record<string, unknown>;

  @OneToMany(() => IntelligenceHistoryEventEntity, (event) => event.dataset)
  events!: Relation<IntelligenceHistoryEventEntity[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
