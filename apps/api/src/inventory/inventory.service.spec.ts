import type { AgentEntity } from '../agents/agent.entity.js';
import type { EquipmentEntity } from '../equipment/equipment.entity.js';
import { MaintenanceService } from '../maintenance/maintenance.service.js';
import { InventoryService } from './inventory.service.js';
import type { Repository } from 'typeorm';

describe('InventoryService', () => {
  it('combines inventory counts with maintenance attention counters', async () => {
    const equipmentQuery = {
      where: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(2),
    };
    const equipmentCount = vi.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(5);
    const agentCount = vi.fn()
      .mockResolvedValueOnce(4).mockResolvedValueOnce(3).mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const overview = vi.fn().mockResolvedValue({ immediate: 1, overdue: 2, upcoming: 3 });
    const service = new InventoryService(
      { count: equipmentCount, createQueryBuilder: vi.fn().mockReturnValue(equipmentQuery) } as unknown as Repository<EquipmentEntity>,
      { count: agentCount } as unknown as Repository<AgentEntity>,
      { overview } as unknown as MaintenanceService,
    );

    await expect(service.summary()).resolves.toEqual({
      totalEquipment: 7,
      operationalEquipment: 5,
      attentionEquipment: 2,
      immediateMaintenance: 1,
      overdueMaintenance: 2,
      upcomingMaintenance: 3,
      totalAgents: 4,
      availableAgents: 3,
      agentsOnDuty: 1,
      agentsOffDuty: 1,
      unavailableAgents: 2,
    });
    expect(equipmentQuery.where).toHaveBeenCalledWith(
      'equipment.status IN (:...statuses)',
      { statuses: ['malfunctioning', 'maintenance', 'stolen'] },
    );
    expect(overview).toHaveBeenCalledOnce();
  });

  it('rejects the summary when any source query fails', async () => {
    const equipmentQuery = { where: vi.fn().mockReturnThis(), getCount: vi.fn().mockResolvedValue(0) };
    const equipment = {
      count: vi.fn().mockRejectedValue(new Error('inventory query failed')),
      createQueryBuilder: vi.fn().mockReturnValue(equipmentQuery),
    };
    const service = new InventoryService(
      equipment as unknown as Repository<EquipmentEntity>,
      { count: vi.fn().mockResolvedValue(0) } as unknown as Repository<AgentEntity>,
      { overview: vi.fn().mockResolvedValue({ immediate: 0, overdue: 0, upcoming: 0 }) } as unknown as MaintenanceService,
    );

    await expect(service.summary()).rejects.toThrow('inventory query failed');
  });
});
