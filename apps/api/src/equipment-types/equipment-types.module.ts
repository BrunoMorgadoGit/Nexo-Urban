import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentTypeEntity } from './equipment-type.entity.js';
import { EquipmentTypesController } from './equipment-types.controller.js';
import { EquipmentTypesService } from './equipment-types.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([EquipmentTypeEntity])],
  controllers: [EquipmentTypesController],
  providers: [EquipmentTypesService],
  exports: [EquipmentTypesService, TypeOrmModule],
})
export class EquipmentTypesModule {}
