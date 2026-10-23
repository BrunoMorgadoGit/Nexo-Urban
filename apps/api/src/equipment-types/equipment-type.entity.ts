import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { EquipmentTypeContract } from '@fogo/contracts';

@Entity({ name: 'equipment_types' })
@Index('uq_equipment_types_code', ['code'], { unique: true })
export class EquipmentTypeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 60 })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  label!: string;

  @Column({ type: 'varchar', length: 20 })
  mobility!: 'fixed' | 'mobile';

  @Column({ name: 'characteristics_schema', type: 'jsonb' })
  characteristics!: EquipmentTypeContract['characteristics'];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
