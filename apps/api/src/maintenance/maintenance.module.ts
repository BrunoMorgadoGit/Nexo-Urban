import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { MaintenanceController } from './maintenance.controller.js';
import { MaintenanceEntity } from './maintenance.entity.js';
import { MaintenanceService } from './maintenance.service.js';
import { MonitoringModule } from '../monitoring/monitoring.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([EquipmentEntity, MaintenanceEntity]), MonitoringModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
