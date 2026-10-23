import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentPositionEntity } from './agent-position.entity.js';
import { EquipmentLocationEntity } from './equipment-location.entity.js';
import { EquipmentPositionEntity } from './equipment-position.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentPositionEntity,
      EquipmentLocationEntity,
      EquipmentPositionEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class LocationsModule {}
