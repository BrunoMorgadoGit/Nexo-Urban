import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  monitoringAlertCodes,
  monitoringAlertSeverities,
  monitoringAlertStatuses,
} from '@fogo/contracts';

export class ListMonitoringAlertsDto {
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
  @IsIn([...monitoringAlertSeverities])
  severity?: string;

  @IsOptional()
  @IsIn([...monitoringAlertStatuses, 'active'])
  status?: string;

  @IsOptional()
  @IsIn([...monitoringAlertCodes])
  code?: string;

  @IsOptional()
  @IsUUID()
  resourceId?: string;
}
