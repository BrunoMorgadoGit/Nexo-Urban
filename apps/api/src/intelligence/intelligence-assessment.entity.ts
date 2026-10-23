import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import type { IntelligenceSourceComposition } from '@fogo/contracts';
import { IntelligenceRegionAssessmentEntity } from './intelligence-region-assessment.entity.js';

@Entity({ name: 'intelligence_assessments' })
@Index('uq_intelligence_assessments_key', ['assessmentKey'], { unique: true })
@Index('idx_intelligence_assessments_scope_reference', ['sourceScope', 'referenceAt'])
export class IntelligenceAssessmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'assessment_key', type: 'varchar', length: 180 })
  assessmentKey!: string;

  @Column({ name: 'source_scope', type: 'varchar', length: 12 })
  sourceScope!: 'demo' | 'manual' | 'all';

  @Column({ name: 'reference_at', type: 'timestamptz' })
  referenceAt!: Date;

  @Column({ name: 'window_start', type: 'timestamptz' })
  windowStart!: Date;

  @Column({ name: 'horizon_hours', type: 'smallint', default: 24 })
  horizonHours!: 24;

  @Column({ name: 'method_version', type: 'varchar', length: 32 })
  methodVersion!: string;

  @Column({ name: 'source_composition', type: 'jsonb' })
  sourceComposition!: IntelligenceSourceComposition;

  @OneToMany(() => IntelligenceRegionAssessmentEntity, (region) => region.assessment)
  regions!: Relation<IntelligenceRegionAssessmentEntity[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
