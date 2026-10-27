import type { DataSource } from 'typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { RegionEntity } from '../regions/region.entity.js';
import { IntelligenceAssessmentEntity } from './intelligence-assessment.entity.js';
import { IntelligenceHistoryEventEntity } from './intelligence-history-event.entity.js';
import { IntelligenceService } from './intelligence.service.js';

describe('IntelligenceService', () => {
  it('uses operational status history and links maintenance alerts to their equipment', async () => {
    const sqlQueries: string[] = [];
    const regionRepository = { find: vi.fn().mockResolvedValue([]) };
    const equipmentQuery = {
      innerJoinAndSelect: vi.fn().mockReturnThis(),
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    const historyQuery = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    const assessmentRepository = {
      upsert: vi.fn().mockResolvedValue(undefined),
      findOneByOrFail: vi.fn().mockResolvedValue({ id: 'assessment-1' }),
    };
    const manager = {
      getRepository: vi.fn((entity: unknown) => entity === IntelligenceAssessmentEntity ? assessmentRepository : {}),
    };
    const dataSource = {
      getRepository: vi.fn((entity: unknown) => {
        if (entity === RegionEntity) return regionRepository;
        if (entity === EquipmentEntity) return { createQueryBuilder: vi.fn().mockReturnValue(equipmentQuery) };
        if (entity === IntelligenceHistoryEventEntity) return { createQueryBuilder: vi.fn().mockReturnValue(historyQuery) };
        return {};
      }),
      query: vi.fn((sql: string) => {
        sqlQueries.push(sql);
        if (sql.includes('FROM operational_alerts alert')) {
          return Promise.resolve([{
            equipmentId: 'equipment-1', regionId: 'region-1', occurredAt: new Date('2026-10-20T12:00:00.000Z'),
            code: 'maintenance_overdue', severity: 'high',
          }]);
        }
        return Promise.resolve([{
          equipmentId: 'equipment-1', regionId: 'region-1', occurredAt: new Date('2026-10-21T12:00:00.000Z'),
          status: 'malfunctioning',
        }]);
      }),
      transaction: vi.fn(async (operation: (manager: unknown) => Promise<void>) => operation(manager)),
    };

    const overview = await new IntelligenceService(dataSource as unknown as DataSource).overview('manual');

    expect(overview.sourceComposition).toMatchObject({ manualObservations: 1, manualIncidents: 1 });
    expect(sqlQueries[0]).toContain("alert.resource_type = 'maintenance'");
    expect(sqlQueries[0]).toContain('maintenance.equipment_id AS "equipmentId"');
    expect(sqlQueries[1]).toContain("event.event_type IN ('equipment.updated', 'equipment.observed')");
    expect(sqlQueries[1]).toContain("event.payload ->> 'status' AS status");
    expect(assessmentRepository.upsert).toHaveBeenCalledOnce();
  });
});
