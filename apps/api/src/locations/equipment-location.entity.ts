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
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { RegionEntity } from '../regions/region.entity.js';

@Entity({ name: 'equipment_locations' })
@Index('uq_equipment_locations_equipment', ['equipmentId'], { unique: true })
export class EquipmentLocationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'equipment_id', type: 'uuid' })
  equipmentId!: string;

  @OneToOne(() => EquipmentEntity, (equipment) => equipment.location, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment!: Relation<EquipmentEntity>;

  @Column({ name: 'postal_code', type: 'varchar', length: 9 })
  postalCode!: string;

  @Column({ type: 'varchar', length: 160 })
  street!: string;

  @Column({ type: 'varchar', length: 100 })
  reference!: string;

  @Column({ name: 'region_id', type: 'uuid' })
  regionId!: string;

  @ManyToOne(() => RegionEntity, { nullable: false })
  @JoinColumn({ name: 'region_id' })
  region!: Relation<RegionEntity>;

  @Column({ type: 'varchar', length: 100 })
  city!: string;

  @Column({ type: 'char', length: 2 })
  state!: string;

  @Column({ name: 'latitude', type: 'double precision' })
  latitude!: number;

  @Column({ name: 'longitude', type: 'double precision' })
  longitude!: number;

  @Column({ type: 'varchar', length: 10 })
  role!: 'fixed' | 'base';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
