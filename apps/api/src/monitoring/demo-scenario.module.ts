import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { DemoScenarioController } from './demo-scenario.controller.js';
import { DemoScenarioService } from './demo-scenario.service.js';
import { MonitoringModule } from './monitoring.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([EquipmentEntity]), MonitoringModule],
  controllers: [DemoScenarioController],
  providers: [DemoScenarioService],
})
export class DemoScenarioModule {}
