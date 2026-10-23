import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from '../agents/agent.entity.js';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { MaintenanceModule } from '../maintenance/maintenance.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity, EquipmentEntity]), MaintenanceModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
