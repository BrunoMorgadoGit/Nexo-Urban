import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { agentAvailabilityStates, agentCategories } from '@fogo/contracts';
import type { AgentAvailability, AgentCategory } from '@fogo/contracts';

class AgentPositionDto {
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @IsDateString()
  recordedAt!: string;
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
}
