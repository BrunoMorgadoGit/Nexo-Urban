import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { MaintenanceController } from './maintenance.controller.js';
import { MaintenanceEntity } from './maintenance.entity.js';
import { MaintenanceService } from './maintenance.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([EquipmentEntity, MaintenanceEntity])],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
