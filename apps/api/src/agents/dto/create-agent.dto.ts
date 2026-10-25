import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { agentAvailabilityStates, agentCategories } from '@fogo/contracts';
import type { AgentAvailability, AgentCategory } from '@fogo/contracts';
import { IsRecordedAtWithinClockSkew } from '../../common/validators/recorded-at.validator.js';

class AgentPositionDto {
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @IsDateString()
  @IsRecordedAtWithinClockSkew()
  recordedAt!: string;

  @IsOptional()
  @IsUUID()
  regionId?: string | null;
}

class OperationalBaseDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsUUID()
  regionId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}

export class CreateAgentDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2)
  @MaxLength(40)
  identifier!: string;

  @IsIn([...agentCategories])
  category!: AgentCategory;

  @IsUUID()
  organizationId!: string;

  @IsIn([...agentAvailabilityStates])
  availability!: AgentAvailability;

  @IsOptional()
  @ValidateNested()
  @Type(() => AgentPositionDto)
  position?: AgentPositionDto | null;

  @IsOptional()
  @IsUUID()
  operationalBaseId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => OperationalBaseDto)
  newOperationalBase?: OperationalBaseDto | null;

  @IsOptional()
  @IsUUID()
  equipmentId?: string | null;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MaxLength(500)
  operationalNotes?: string | null;
}
