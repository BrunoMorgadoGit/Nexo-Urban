import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentTypesModule } from '../equipment-types/equipment-types.module.js';
import { LocationsModule } from '../locations/locations.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { RegionsModule } from '../regions/regions.module.js';
import { EquipmentController } from './equipment.controller.js';
import { EquipmentEntity } from './equipment.entity.js';
import { EquipmentService } from './equipment.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([EquipmentEntity]),
    EquipmentTypesModule,
    LocationsModule,
    OrganizationsModule,
    RegionsModule,
  ],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
