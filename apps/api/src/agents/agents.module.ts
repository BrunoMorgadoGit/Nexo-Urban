import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsModule } from '../locations/locations.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { AgentEntity } from './agent.entity.js';
import { AgentsController } from './agents.controller.js';
import { AgentsService } from './agents.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentEntity]),
    LocationsModule,
    OrganizationsModule,
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
