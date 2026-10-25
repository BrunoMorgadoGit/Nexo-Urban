import {
  Check,
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
import { RegionEntity } from '../regions/region.entity.js';

@Entity({ name: 'operational_bases' })
@Index('idx_operational_bases_region', ['regionId'])
@Check('chk_operational_bases_coordinates_pair', '("latitude" IS NULL) = ("longitude" IS NULL)')
@Check('chk_operational_bases_latitude', '"latitude" IS NULL OR "latitude" BETWEEN -90 AND 90')
@Check('chk_operational_bases_longitude', '"longitude" IS NULL OR "longitude" BETWEEN -180 AND 180')
export class OperationalBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'region_id', type: 'uuid', nullable: true })
  regionId!: string | null;

  @ManyToOne(() => RegionEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'region_id' })
  region!: Relation<RegionEntity> | null;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
