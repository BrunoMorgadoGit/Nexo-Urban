import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { EquipmentLocationEntity } from '../locations/equipment-location.entity.js';
import { MaintenanceEntity } from '../maintenance/maintenance.entity.js';
import { RegionEntity } from '../regions/region.entity.js';
import { IntelligenceAssessmentEntity } from './intelligence-assessment.entity.js';
import { IntelligenceDatasetEntity } from './intelligence-dataset.entity.js';
import { IntelligenceHistoryEventEntity } from './intelligence-history-event.entity.js';
import { IntelligenceRegionAssessmentEntity } from './intelligence-region-assessment.entity.js';
import { IntelligenceController } from './intelligence.controller.js';
import { IntelligenceService } from './intelligence.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([
    EquipmentEntity,
    EquipmentLocationEntity,
    MaintenanceEntity,
    RegionEntity,
    IntelligenceAssessmentEntity,
    IntelligenceDatasetEntity,
    IntelligenceHistoryEventEntity,
    IntelligenceRegionAssessmentEntity,
  ])],
  controllers: [IntelligenceController],
  providers: [IntelligenceService],
})
export class IntelligenceModule {}
