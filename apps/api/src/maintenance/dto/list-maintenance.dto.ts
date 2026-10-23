import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListMaintenanceDto {
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
  @IsUUID()
  equipmentId?: string;

  @IsOptional()
  @IsIn(['scheduled', 'in_progress', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  overdueOnly = false;
}
