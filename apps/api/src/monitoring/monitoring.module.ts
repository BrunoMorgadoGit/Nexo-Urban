import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from '../agents/agent.entity.js';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { EquipmentLocationEntity } from '../locations/equipment-location.entity.js';
import { EquipmentPositionEntity } from '../locations/equipment-position.entity.js';
import { AgentPositionEntity } from '../locations/agent-position.entity.js';
import { MaintenanceEntity } from '../maintenance/maintenance.entity.js';
import { RegionEntity } from '../regions/region.entity.js';
import { OperationalAlertActionEntity } from './operational-alert-action.entity.js';
import { OperationalAlertEntity } from './operational-alert.entity.js';
import { OperationalEventEntity } from './operational-event.entity.js';
import { MonitoringAlertsService } from './monitoring-alerts.service.js';
import { MonitoringController } from './monitoring.controller.js';
import { MonitoringEventsService } from './monitoring-events.service.js';
import { MonitoringReadService } from './monitoring-read.service.js';
import { MonitoringWriteService } from './monitoring-write.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([
    AgentEntity,
    AgentPositionEntity,
    EquipmentEntity,
    EquipmentLocationEntity,
    EquipmentPositionEntity,
    MaintenanceEntity,
    RegionEntity,
    OperationalAlertEntity,
    OperationalAlertActionEntity,
    OperationalEventEntity,
  ])],
  controllers: [MonitoringController],
  providers: [MonitoringReadService, MonitoringWriteService, MonitoringAlertsService, MonitoringEventsService],
  exports: [MonitoringWriteService],
})
export class MonitoringModule {}
