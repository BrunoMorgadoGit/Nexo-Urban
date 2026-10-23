import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import type { IntelligenceDataQuality, IntelligenceRiskClassification, IntelligenceRiskFactor } from '@fogo/contracts';
import { RegionEntity } from '../regions/region.entity.js';
import { IntelligenceAssessmentEntity } from './intelligence-assessment.entity.js';

@Entity({ name: 'intelligence_region_assessments' })
@Index('uq_intelligence_region_assessment', ['assessmentId', 'regionId'], { unique: true })
@Index('idx_intelligence_region_assessment_region', ['regionId', 'assessmentId'])
export class IntelligenceRegionAssessmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'assessment_id', type: 'uuid' })
  assessmentId!: string;

  @ManyToOne(() => IntelligenceAssessmentEntity, (assessment) => assessment.regions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_id' })
  assessment!: Relation<IntelligenceAssessmentEntity>;

  @Column({ name: 'region_id', type: 'uuid' })
  regionId!: string;

  @ManyToOne(() => RegionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'region_id' })
  region!: Relation<RegionEntity>;

  @Column({ name: 'risk_score', type: 'smallint', nullable: true })
  riskScore!: number | null;

  @Column({ type: 'varchar', length: 24 })
  classification!: IntelligenceRiskClassification;

  @Column({ name: 'data_quality', type: 'varchar', length: 16 })
  dataQuality!: IntelligenceDataQuality;

  @Column({ name: 'observation_count', type: 'integer', default: 0 })
  observationCount!: number;

  @Column({ name: 'failure_count', type: 'integer', default: 0 })
  failureCount!: number;

  @Column({ name: 'eligible_equipment_count', type: 'integer', default: 0 })
  eligibleEquipmentCount!: number;

  @Column({ name: 'unavailable_equipment_count', type: 'integer', default: 0 })
  unavailableEquipmentCount!: number;

  @Column({ name: 'coverage_days', type: 'smallint', default: 0 })
  coverageDays!: number;

  @Column({ type: 'jsonb' })
  factors!: IntelligenceRiskFactor[];

  @Column({ type: 'jsonb' })
  recommendations!: string[];
}
