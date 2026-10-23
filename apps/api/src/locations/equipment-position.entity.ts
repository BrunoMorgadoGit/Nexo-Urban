import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';

@Entity({ name: 'equipment_positions' })
@Index('uq_equipment_positions_equipment', ['equipmentId'], { unique: true })
export class EquipmentPositionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'equipment_id', type: 'uuid' })
  equipmentId!: string;

  @OneToOne(() => EquipmentEntity, (equipment) => equipment.lastPosition, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment!: Relation<EquipmentEntity>;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
