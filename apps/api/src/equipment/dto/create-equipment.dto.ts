import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { equipmentStatuses, maintenancePriorities } from '@fogo/contracts';
import type { EquipmentStatus, MaintenancePriority } from '@fogo/contracts';
import { EquipmentLocationDto } from './equipment-location.dto.js';
import { LastPositionDto } from './last-position.dto.js';

export class CreateEquipmentDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2)
  @MaxLength(60)
  typeCode!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2)
  @MaxLength(80)
  serialNumber!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  @MaxLength(80)
  brand!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  @MaxLength(100)
  model!: string;

  @IsUUID()
  organizationId!: string;

  @IsIn([...equipmentStatuses])
  status!: EquipmentStatus;

  @IsIn([...maintenancePriorities])
  maintenancePriority!: MaintenancePriority;

  @IsOptional()
  @IsDateString({ strict: true })
  nextMaintenanceDate?: string | null;

  @IsObject()
  characteristics!: Record<string, unknown>;

  @ValidateNested()
  @Type(() => EquipmentLocationDto)
  location!: EquipmentLocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LastPositionDto)
  lastPosition?: LastPositionDto | null;
}
