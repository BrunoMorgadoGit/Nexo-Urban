import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { maintenancePriorities } from '@fogo/contracts';
import type { MaintenancePriority } from '@fogo/contracts';
import type { MaintenanceKind } from '../maintenance.entity.js';

export class CreateMaintenanceDto {
  @IsUUID()
  equipmentId!: string;

  @IsIn(['immediate', 'scheduled', 'periodic'])
  kind!: MaintenanceKind;

  @IsIn([...maintenancePriorities])
  priority!: MaintenancePriority;

  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(4)
  @MaxLength(500)
  description!: string;

  @IsDateString({ strict: true })
  scheduledDate!: string;
}
