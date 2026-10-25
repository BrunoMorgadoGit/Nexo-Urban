import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { InventorySummary } from '@fogo/contracts';
import { Repository } from 'typeorm';
import { AgentEntity } from '../agents/agent.entity.js';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { MaintenanceService } from '../maintenance/maintenance.service.js';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(EquipmentEntity)
    private readonly equipment: Repository<EquipmentEntity>,
    @InjectRepository(AgentEntity)
    private readonly agents: Repository<AgentEntity>,
    private readonly maintenance: MaintenanceService,
  ) {}

  async summary(): Promise<InventorySummary> {
    const [totalEquipment, operationalEquipment, attentionEquipment, totalAgents, availableAgents, agentsOnDuty, agentsOffDuty, unavailableAgents, work] =
      await Promise.all([
        this.equipment.count(),
        this.equipment.count({ where: { status: 'operational' } }),
        this.equipment
          .createQueryBuilder('equipment')
          .where('equipment.status IN (:...statuses)', { statuses: ['malfunctioning', 'maintenance', 'stolen'] })
          .getCount(),
        this.agents.count(),
        this.agents.count({ where: { availability: 'available' } }),
        this.agents.count({ where: { availability: 'on_duty' } }),
        this.agents.count({ where: { availability: 'off_duty' } }),
        this.agents.count({ where: { availability: 'unavailable' } }),
        this.maintenance.overview(),
      ]);
    return {
      totalEquipment,
      operationalEquipment,
      attentionEquipment,
      immediateMaintenance: work.immediate,
      overdueMaintenance: work.overdue,
      upcomingMaintenance: work.upcoming,
      totalAgents,
      availableAgents,
      agentsOnDuty,
      agentsOffDuty,
      unavailableAgents,
    };
  }
}
