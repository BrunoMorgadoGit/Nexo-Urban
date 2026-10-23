import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { agentAvailabilityStates, equipmentStatuses } from '@fogo/contracts';

export class MonitoringMapQueryDto {
  @IsOptional()
  @IsIn(['all', 'equipment', 'agent'])
  resourceType: 'all' | 'equipment' | 'agent' = 'all';

  @IsOptional()
  @IsString()
  @MaxLength(60)
  typeCode?: string;

  @IsOptional()
  @IsIn([...equipmentStatuses, ...agentAvailabilityStates])
  status?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  regionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  regionZone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  west?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  south?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  east?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  north?: number;
}
