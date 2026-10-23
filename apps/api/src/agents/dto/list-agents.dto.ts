import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { agentAvailabilityStates, agentCategories } from '@fogo/contracts';

export class ListAgentsDto {
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
  @IsIn([...agentCategories])
  category?: string;

  @IsOptional()
  @IsIn([...agentAvailabilityStates])
  availability?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
