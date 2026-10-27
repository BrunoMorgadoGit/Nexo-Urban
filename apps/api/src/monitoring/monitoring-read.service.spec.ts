import type { DataSource } from 'typeorm';
import { MonitoringReadService } from './monitoring-read.service.js';

describe('MonitoringReadService', () => {
  function makeService(queryResults: unknown[] = []) {
    const dataSource = {
      query: vi.fn().mockResolvedValue(queryResults),
    };
    return { service: new MonitoringReadService(dataSource as unknown as DataSource), dataSource };
  }

  it('maps both urgent work orders and inventory-only maintenance schedules', async () => {
    const { service, dataSource } = makeService([
      {
        source: 'work_order', maintenance_id: 'maintenance-1', equipment_id: 'equipment-1',
        serial_number: 'RAD-01', type_label: 'Radar de velocidade', scheduled_date: '2026-10-26',
        description: 'Inspeção', priority: 'high', status: 'scheduled', urgency: 'overdue',
      },
      {
        source: 'inventory_schedule', maintenance_id: null, equipment_id: 'equipment-2',
        serial_number: 'CAM-02', type_label: 'Câmera', scheduled_date: '2026-10-28',
        description: 'Próxima manutenção registrada no inventário.', priority: 'normal', status: null, urgency: 'upcoming',
      },
    ]);

    await expect(service.maintenanceAlerts()).resolves.toEqual([
      {
        source: 'work_order', maintenanceId: 'maintenance-1', equipmentId: 'equipment-1',
        serialNumber: 'RAD-01', typeLabel: 'Radar de velocidade', scheduledDate: '2026-10-26',
        description: 'Inspeção', priority: 'high', status: 'scheduled', urgency: 'overdue',
      },
      {
        source: 'inventory_schedule', maintenanceId: null, equipmentId: 'equipment-2',
        serialNumber: 'CAM-02', typeLabel: 'Câmera', scheduledDate: '2026-10-28',
        description: 'Próxima manutenção registrada no inventário.', priority: 'normal', status: null, urgency: 'upcoming',
      },
    ]);
    const query = dataSource.query.mock.calls[0]?.[0] as string;
    expect(query).toContain("'inventory_schedule'::text AS source");
    expect(query).toContain('NOT EXISTS');
    expect(query).toContain("ORDER BY CASE attention.urgency WHEN 'overdue' THEN 0 WHEN 'immediate' THEN 1 ELSE 2 END");
    expect(query).toContain('LIMIT 12');
  });

  it('keeps an immediate inventory-only item visible when no date is registered', async () => {
    const { service } = makeService([{
      source: 'inventory_schedule', maintenance_id: null, equipment_id: 'equipment-urgent',
      serial_number: 'RAD-URG', type_label: 'Radar de velocidade', scheduled_date: null,
      description: 'Próxima manutenção registrada no inventário.', priority: 'immediate', status: null,
      urgency: 'immediate',
    }]);

    await expect(service.maintenanceAlerts()).resolves.toMatchObject([{
      source: 'inventory_schedule', maintenanceId: null, equipmentId: 'equipment-urgent',
      scheduledDate: null, priority: 'immediate', status: null, urgency: 'immediate',
    }]);
  });
});
