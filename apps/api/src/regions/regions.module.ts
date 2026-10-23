import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegionEntity } from './region.entity.js';
import { RegionsController } from './regions.controller.js';
import { RegionsService } from './regions.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([RegionEntity])],
  controllers: [RegionsController],
  providers: [RegionsService],
  exports: [RegionsService, TypeOrmModule],
})
export class RegionsModule {}
