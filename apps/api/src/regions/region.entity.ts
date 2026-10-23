import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'regions' })
@Index('uq_regions_city_state_name', ['city', 'state', 'name'], { unique: true })
@Index('uq_regions_code', ['code'], { unique: true })
export class RegionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  zone!: string;

  @Column({ type: 'varchar', length: 100 })
  city!: string;

  @Column({ type: 'char', length: 2 })
  state!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
