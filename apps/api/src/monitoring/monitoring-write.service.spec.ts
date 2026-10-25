import type { OperationalEvent, OperationalEventType } from '@fogo/contracts';
import type { DataSource, EntityManager } from 'typeorm';
import { addCalendarDays, operationalDateKey } from '../common/operational-date.js';
import { AgentEntity } from '../agents/agent.entity.js';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { MaintenanceEntity } from '../maintenance/maintenance.entity.js';
import { OperationalAlertActionEntity } from './operational-alert-action.entity.js';
import { OperationalAlertEntity } from './operational-alert.entity.js';
import { OperationalEventEntity } from './operational-event.entity.js';
import { MonitoringWriteService } from './monitoring-write.service.js';

const timestamp = new Date('2026-10-24T12:00:00.000Z');

function maintenance(overrides: Partial<MaintenanceEntity> = {}): MaintenanceEntity {
  return Object.assign({
    id: 'maintenance-1', equipmentId: 'equipment-1', status: 'scheduled',
    priority: 'normal', kind: 'scheduled', scheduledDate: addCalendarDays(operationalDateKey(), 1),
    description: 'Inspeção preventiva',
  }, overrides) as MaintenanceEntity;
}

function makeHarness(options: {
  equipment?: EquipmentEntity | null;
  maintenances?: MaintenanceEntity[];
  activeAlerts?: OperationalAlertEntity[];
  insertedIds?: Array<string | undefined>;
  agent?: AgentEntity | null;
  changedMaintenance?: MaintenanceEntity | null;
} = {}) {
  const equipment = options.equipment === undefined
    ? { id: 'equipment-1', status: 'operational', serialNumber: 'RAD-01' } as EquipmentEntity
    : options.equipment;
  const equipmentRepository = {
    findOne: vi.fn().mockResolvedValue(equipment),
    find: vi.fn().mockResolvedValue([{ id: 'equipment-1' }, { id: 'equipment-2' }]),
  };
  const maintenanceRepository = {
    find: vi.fn().mockResolvedValue(options.maintenances ?? []),
    findOne: vi.fn().mockResolvedValue(options.changedMaintenance === undefined ? null : options.changedMaintenance),
  };
  const selectedAlerts = options.activeAlerts ?? [];
  const selectBuilder = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(selectedAlerts),
  };
  let insertIndex = 0;
  const insertBuilder = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    orIgnore: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    execute: vi.fn(async () => {
      const id = options.insertedIds && insertIndex < options.insertedIds.length
        ? options.insertedIds[insertIndex]
        : `alert-${insertIndex + 1}`;
      insertIndex += 1;
      return { raw: id ? [{ id }] : [] };
    }),
  };
  const alertRepository = {
    createQueryBuilder: vi.fn((alias?: string) => alias === 'alert' ? selectBuilder : insertBuilder),
    save: vi.fn(async (alert: OperationalAlertEntity) => alert),
  };
  const savedActions: Array<Record<string, unknown>> = [];
  const actionRepository = { save: vi.fn(async (action: Record<string, unknown>) => { savedActions.push(action); return action; }) };
  let eventId = 0;
  const eventRepository = {
    create: vi.fn((values: Partial<OperationalEventEntity>) => values),
    save: vi.fn(async (values: Partial<OperationalEventEntity>) => Object.assign({}, values, {
      id: String(++eventId), createdAt: timestamp,
    }) as OperationalEventEntity),
  };
  const agentRepository = { findOne: vi.fn().mockResolvedValue(options.agent ?? null) };
  const manager = {
    getRepository: vi.fn((entity: unknown) => {
      if (entity === EquipmentEntity) return equipmentRepository;
      if (entity === MaintenanceEntity) return maintenanceRepository;
      if (entity === OperationalAlertEntity) return alertRepository;
      if (entity === OperationalAlertActionEntity) return actionRepository;
      if (entity === OperationalEventEntity) return eventRepository;
      return agentRepository;
    }),
  };
  const dataSource = {
    getRepository: vi.fn().mockReturnValue(equipmentRepository),
    transaction: vi.fn(async (operation: (manager: EntityManager) => unknown) => operation(manager as unknown as EntityManager)),
  };
  const service = new MonitoringWriteService(dataSource as unknown as DataSource);
  return { service, manager, dataSource, equipmentRepository, maintenanceRepository, alertRepository, selectBuilder, insertBuilder, actionRepository, savedActions, eventRepository };
}

describe('MonitoringWriteService', () => {
  it.each([
    ['malfunctioning', 'equipment_malfunctioning'],
    ['stolen', 'equipment_stolen'],
    ['maintenance', 'equipment_unavailable'],
    ['deactivated', 'equipment_unavailable'],
  ] as const)('opens the corresponding equipment alert for status %s', async (status, code) => {
    const harness = makeHarness({ equipment: { id: 'equipment-1', status, serialNumber: 'RAD-01' } as EquipmentEntity });

    const events = await harness.service.equipmentChanged(harness.manager as unknown as EntityManager, 'equipment-1', 'operational');

    expect(events.map(({ eventType }) => eventType)).toEqual(['alert.created', 'equipment.updated']);
    expect(harness.insertBuilder.values).toHaveBeenCalledWith(expect.objectContaining({ code, resourceId: 'equipment-1' }));
    expect(harness.savedActions[0]).toMatchObject({ type: 'created', actor: 'Monitoramento automático' });
  });

  it('records an update without opening an alert for an operational equipment', async () => {
    const harness = makeHarness();

    const events = await harness.service.equipmentChanged(harness.manager as unknown as EntityManager, 'equipment-1', null);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: 'equipment.updated', payload: { previousStatus: null, status: 'operational', alertsCreated: [], alertsResolved: [] } });
    expect(harness.insertBuilder.execute).not.toHaveBeenCalled();
  });

  it('does not create a duplicate for a condition that already has an active alert', async () => {
    const activeAlert = { id: 'existing-alert', fingerprint: 'equipment:equipment-1:malfunctioning' } as OperationalAlertEntity;
    const harness = makeHarness({
      equipment: { id: 'equipment-1', status: 'malfunctioning', serialNumber: 'RAD-01' } as EquipmentEntity,
      activeAlerts: [activeAlert],
    });

    const events = await harness.service.equipmentChanged(harness.manager as unknown as EntityManager, 'equipment-1', 'operational');

    expect(harness.insertBuilder.execute).not.toHaveBeenCalled();
    expect(events.map(({ eventType }) => eventType)).toEqual(['equipment.updated']);
  });

  it('closes an active alert after its condition normalizes and records the resolution', async () => {
    const activeAlert = {
      id: 'alert-old', fingerprint: 'equipment:equipment-1:malfunctioning', code: 'equipment_malfunctioning',
      status: 'acknowledged', resolvedAt: null,
    } as OperationalAlertEntity;
    const harness = makeHarness({ activeAlerts: [activeAlert] });

    const events = await harness.service.equipmentChanged(harness.manager as unknown as EntityManager, 'equipment-1', 'malfunctioning');

    expect(activeAlert.status).toBe('resolved');
    expect(activeAlert.resolvedAt).toBeInstanceOf(Date);
    expect(harness.savedActions[0]).toMatchObject({ alertId: 'alert-old', type: 'resolved' });
    expect(events.map(({ eventType }) => eventType)).toEqual(['alert.resolved', 'equipment.updated']);
  });

  it('creates urgent and overdue alerts only for active maintenance records', async () => {
    const records = [
      maintenance({ id: 'urgent', kind: 'immediate', priority: 'normal' }),
      maintenance({ id: 'overdue', scheduledDate: addCalendarDays(operationalDateKey(), -1) }),
      maintenance({ id: 'completed', status: 'completed', kind: 'immediate', scheduledDate: addCalendarDays(operationalDateKey(), -1) }),
    ];
    const harness = makeHarness({ maintenances: records });

    const events = await harness.service.equipmentChanged(harness.manager as unknown as EntityManager, 'equipment-1', null);

    expect(harness.insertBuilder.values).toHaveBeenCalledTimes(2);
    expect(harness.insertBuilder.values).toHaveBeenNthCalledWith(1, expect.objectContaining({
      fingerprint: 'equipment:equipment-1:maintenance:urgent:immediate', code: 'maintenance_immediate',
    }));
    expect(harness.insertBuilder.values).toHaveBeenNthCalledWith(2, expect.objectContaining({
      fingerprint: 'equipment:equipment-1:maintenance:overdue:overdue', code: 'maintenance_overdue',
    }));
    expect(events).toHaveLength(3);
  });

  it('skips action and alert events when a concurrent insert was ignored', async () => {
    const harness = makeHarness({
      equipment: { id: 'equipment-1', status: 'malfunctioning', serialNumber: 'RAD-01' } as EquipmentEntity,
      insertedIds: [undefined],
    });

    const events = await harness.service.equipmentChanged(harness.manager as unknown as EntityManager, 'equipment-1', 'operational');

    expect(harness.actionRepository.save).not.toHaveBeenCalled();
    expect(events.map(({ eventType }) => eventType)).toEqual(['equipment.updated']);
  });

  it('does not reconcile missing equipment, agents or maintenance records', async () => {
    const harness = makeHarness({ equipment: null });
    await expect(harness.service.equipmentChanged(harness.manager as unknown as EntityManager, 'missing', null)).resolves.toEqual([]);
    await expect(harness.service.agentChanged(harness.manager as unknown as EntityManager, 'missing')).resolves.toEqual([]);
    await expect(harness.service.maintenanceChanged(
      harness.manager as unknown as EntityManager,
      'missing',
      'maintenance.updated',
      {},
    )).resolves.toEqual([]);
  });

  it('reconciles equipment and appends an event when maintenance changes', async () => {
    const changedMaintenance = maintenance({ id: 'maintenance-9', equipmentId: 'equipment-1' });
    const harness = makeHarness({ changedMaintenance });

    const events = await harness.service.maintenanceChanged(
      harness.manager as unknown as EntityManager,
      changedMaintenance.id,
      'maintenance.updated',
      { status: changedMaintenance.status },
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'maintenance.updated', resourceType: 'maintenance', resourceId: changedMaintenance.id,
      payload: { status: 'operational', alertsCreated: [], alertsResolved: [] },
    });
  });

  it('appends an agent event and publishes domain events to live subscribers', async () => {
    const harness = makeHarness({ agent: { id: 'agent-1', availability: 'on_duty', dataOrigin: 'manual' } as AgentEntity });
    const emitted: OperationalEvent[] = [];
    const subscription = harness.service.events$.subscribe((event) => emitted.push(event));
    const events = await harness.service.agentChanged(harness.manager as unknown as EntityManager, 'agent-1');

    harness.service.publish(events);

    expect(events[0]).toMatchObject({ eventType: 'agent.updated', resourceType: 'agent', payload: { availability: 'on_duty', dataOrigin: 'manual' } });
    expect(emitted[0]).toMatchObject({ id: '1', type: 'agent.updated', resourceId: 'agent-1', occurredAt: timestamp.toISOString() });
    subscription.unsubscribe();
  });

  it('uses the demo source and demo scenario resource type for scenario events', async () => {
    const harness = makeHarness();
    const eventType: OperationalEventType = 'demo.scenario.changed';

    const events = await harness.service.equipmentChanged(
      harness.manager as unknown as EntityManager,
      'equipment-1',
      'operational',
      'demo',
      eventType,
      { scenario: 'outage' },
    );

    expect(events[0]).toMatchObject({
      eventType, source: 'demo', resourceType: 'demo_scenario',
      payload: { previousStatus: 'operational', scenario: 'outage', status: 'operational' },
    });
  });

  it('reconciles every equipment record during application bootstrap', async () => {
    const harness = makeHarness();

    await harness.service.onApplicationBootstrap();

    expect(harness.equipmentRepository.find).toHaveBeenCalledWith({ select: { id: true } });
    expect(harness.dataSource.transaction).toHaveBeenCalledTimes(2);
  });
});
