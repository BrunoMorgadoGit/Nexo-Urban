import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsModule } from '../locations/locations.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { AgentEntity } from './agent.entity.js';
import { OperationalBaseEntity } from './operational-base.entity.js';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { AgentsController } from './agents.controller.js';
import { AgentsService } from './agents.service.js';
import { MonitoringModule } from '../monitoring/monitoring.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentEntity, OperationalBaseEntity, EquipmentEntity]),
    LocationsModule,
    OrganizationsModule,
    MonitoringModule,
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
