import { IsIn } from 'class-validator';
import type { MaintenanceStatus } from '../maintenance.entity.js';

export class UpdateMaintenanceStatusDto {
  @IsIn(['scheduled', 'in_progress', 'completed', 'cancelled'])
  status!: MaintenanceStatus;
}
