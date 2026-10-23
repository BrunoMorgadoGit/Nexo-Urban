import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { equipmentStatuses } from '@fogo/contracts';

export class ListEquipmentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  typeCode?: string;

  @IsOptional()
  @IsIn([...equipmentStatuses])
  status?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  regionId?: string;
}
