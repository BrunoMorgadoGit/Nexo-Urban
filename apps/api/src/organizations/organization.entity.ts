import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'organizations' })
@Index('uq_organizations_code', ['code'], { unique: true })
export class OrganizationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
