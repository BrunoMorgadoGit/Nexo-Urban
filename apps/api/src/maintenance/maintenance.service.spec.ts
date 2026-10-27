import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { addCalendarDays, operationalDateKey } from '../common/operational-date.js';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { MonitoringWriteService } from '../monitoring/monitoring-write.service.js';
import { MaintenanceEntity } from './maintenance.entity.js';
import { MaintenanceService } from './maintenance.service.js';
import type { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';

const timestamp = new Date('2026-10-20T10:00:00.000Z');
const equipment = { id: 'equipment-1', status: 'operational', serialNumber: 'RAD-01' } as EquipmentEntity;

function maintenanceRecord(overrides: Partial<MaintenanceEntity> = {}): MaintenanceEntity {
  return Object.assign({
    id: 'maintenance-1', equipmentId: equipment.id, equipment: Object.assign({}, equipment, { type: { label: 'Radar' } }),
    kind: 'scheduled', status: 'scheduled', priority: 'normal', description: 'Inspeção preventiva',
    scheduledDate: addCalendarDays(operationalDateKey(), -1), completedAt: null,
    createdAt: timestamp,
  }, overrides) as MaintenanceEntity;
}

const input = (overrides: Partial<CreateMaintenanceDto> = {}): CreateMaintenanceDto => ({
  equipmentId: equipment.id, kind: 'scheduled', priority: 'normal',
  description: '  Inspeção preventiva  ', scheduledDate: addCalendarDays(operationalDateKey(), -1),
  ...overrides,
});

function listBuilder(result: [MaintenanceEntity[], number] = [[], 0]) {
  return {
    innerJoinAndSelect: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue(result),
  };
}

function makeService(options: {
  equipmentRecord?: EquipmentEntity | null;
  record?: MaintenanceEntity | null;
  current?: MaintenanceEntity | null;
  activeMaintenances?: MaintenanceEntity[];
  listQuery?: ReturnType<typeof listBuilder>;
} = {}) {
  const persisted = options.record ?? maintenanceRecord();
  const repository = {
    findOne: vi.fn().mockResolvedValue(persisted),
    createQueryBuilder: vi.fn().mockReturnValue(options.listQuery ?? listBuilder()),
  };
  const equipmentRepository = { findOne: vi.fn().mockResolvedValue(options.equipmentRecord === undefined ? equipment : options.equipmentRecord) };
  const storedMaintenances = [...(options.activeMaintenances ?? []), ...(options.current ? [options.current] : [])];
  const transactionRepository = {
    create: vi.fn((values: Partial<MaintenanceEntity>) => values),
    save: vi.fn(async (values: Partial<MaintenanceEntity>) => {
      const saved = Object.assign({}, persisted, values) as MaintenanceEntity;
      const index = storedMaintenances.findIndex((record) => record.id === saved.id);
      if (index < 0) storedMaintenances.push(saved);
      else storedMaintenances[index] = saved;
      return saved;
    }),
    findOne: vi.fn(async ({ where }: { where: { id: string } }) => storedMaintenances.find(({ id }) => id === where.id) ?? null),
    find: vi.fn(async ({ where }: { where: { equipmentId: string } }) => storedMaintenances.filter(({ equipmentId }) => equipmentId === where.equipmentId)),
  };
  const transactionEquipmentRepository = {
    findOne: vi.fn().mockResolvedValue(options.equipmentRecord === undefined ? equipment : options.equipmentRecord),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const manager = {
    getRepository: vi.fn((entity: unknown) => entity === MaintenanceEntity ? transactionRepository : transactionEquipmentRepository),
  };
  const dataSource = {
    transaction: vi.fn(async (operation: (manager: EntityManager) => unknown) => operation(manager as unknown as EntityManager)),
  };
  const monitoringWrite = {
    maintenanceChanged: vi.fn().mockResolvedValue([]),
    publish: vi.fn(),
  };
  const service = new MaintenanceService(
    dataSource as unknown as DataSource,
    repository as unknown as Repository<MaintenanceEntity>,
    equipmentRepository as unknown as Repository<EquipmentEntity>,
    monitoringWrite as unknown as MonitoringWriteService,
  );
  return { service, repository, equipmentRepository, transactionRepository, transactionEquipmentRepository, dataSource, monitoringWrite, manager };
}

describe('MaintenanceService', () => {
  it('creates a trimmed scheduled record and returns the overdue contract state', async () => {
    const record = maintenanceRecord();
    const harness = makeService({ record });

    const result = await harness.service.create(input());

    expect(result).toMatchObject({ id: 'maintenance-1', description: 'Inspeção preventiva', overdue: true });
    expect(harness.transactionEquipmentRepository.update).toHaveBeenCalledWith(equipment.id, {
      nextMaintenanceDate: input().scheduledDate,
      maintenancePriority: 'normal',
    });
    expect(harness.transactionRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Inspeção preventiva', status: 'scheduled', completedAt: null,
    }));
    expect(harness.monitoringWrite.publish).toHaveBeenCalledWith([]);
  });

  it('summarizes the earliest date and strongest priority across active work orders', async () => {
    const earlierDate = addCalendarDays(operationalDateKey(), 2);
    const existing = maintenanceRecord({
      id: 'maintenance-existing', status: 'in_progress', priority: 'high',
      scheduledDate: addCalendarDays(operationalDateKey(), 5),
    });
    const harness = makeService({ activeMaintenances: [existing] });

    await harness.service.create(input({ priority: 'normal', scheduledDate: earlierDate }));

    expect(harness.transactionEquipmentRepository.update).toHaveBeenCalledWith(equipment.id, {
      nextMaintenanceDate: earlierDate,
      maintenancePriority: 'high',
    });
  });

  it.each([
    ['missing', null],
    ['deactivated', Object.assign({}, equipment, { status: 'deactivated' }) as EquipmentEntity],
    ['stolen', Object.assign({}, equipment, { status: 'stolen' }) as EquipmentEntity],
  ])('rejects creation when equipment is %s', async (_state, equipmentRecord) => {
    const harness = makeService({ equipmentRecord });

    await expect(harness.service.create(input())).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('filters maintenance rows and maps total pages', async () => {
    const builder = listBuilder([[maintenanceRecord()], 5]);
    const harness = makeService({ listQuery: builder });

    await expect(harness.service.list({ equipmentId: equipment.id, status: 'scheduled', overdueOnly: true, page: 2, pageSize: 2 })).resolves.toMatchObject({
      page: 2, pageSize: 2, total: 5, totalPages: 3, items: [{ id: 'maintenance-1', overdue: true }],
    });
    expect(builder.andWhere).toHaveBeenCalledTimes(4);
    expect(builder.skip).toHaveBeenCalledWith(2);
    expect(builder.take).toHaveBeenCalledWith(2);
  });

  it('uses default paging and does not add optional filters', async () => {
    const builder = listBuilder();
    const harness = makeService({ listQuery: builder });

    await expect(harness.service.list({})).resolves.toMatchObject({ page: 1, pageSize: 20, totalPages: 0, items: [] });
    expect(builder.andWhere).not.toHaveBeenCalled();
  });

  it('counts immediate, overdue and upcoming active work separately', async () => {
    const builders = [2, 3, 4].map((count) => ({
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(count),
    }));
    const repository = { createQueryBuilder: vi.fn().mockImplementation(() => builders.shift()) };
    const service = new MaintenanceService(
      {} as DataSource,
      repository as unknown as Repository<MaintenanceEntity>,
      {} as Repository<EquipmentEntity>,
      {} as MonitoringWriteService,
    );

    await expect(service.overview()).resolves.toEqual({ immediate: 2, overdue: 3, upcoming: 4 });
    expect(repository.createQueryBuilder).toHaveBeenCalledTimes(3);
    expect(builders).toHaveLength(0);
  });

  it('moves scheduled work to in progress and records an operational update', async () => {
    const current = maintenanceRecord();
    const harness = makeService({ current, record: Object.assign({}, current, { status: 'in_progress' }) as MaintenanceEntity });

    await expect(harness.service.updateStatus(current.id, 'in_progress')).resolves.toMatchObject({ status: 'in_progress' });
    expect(harness.transactionRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'in_progress', completedAt: null }));
    expect(harness.monitoringWrite.maintenanceChanged).toHaveBeenCalledWith(
      harness.manager,
      current.id,
      'maintenance.updated',
      expect.objectContaining({ status: 'in_progress' }),
    );
  });

  it('sets completion time when work is completed', async () => {
    const current = maintenanceRecord({ status: 'in_progress' });
    const harness = makeService({ current, record: Object.assign({}, current, { status: 'completed', completedAt: timestamp }) as MaintenanceEntity });

    await expect(harness.service.updateStatus(current.id, 'completed')).resolves.toMatchObject({
      status: 'completed', completedAt: timestamp.toISOString(), overdue: false,
    });
    const saved = harness.transactionRepository.save.mock.calls[0]?.[0];
    expect(saved?.completedAt).toBeInstanceOf(Date);
  });

  it('clears stale equipment urgency when its only maintenance order is completed', async () => {
    const scheduledDate = addCalendarDays(operationalDateKey(), -1);
    const current = maintenanceRecord({ status: 'in_progress', priority: 'immediate', scheduledDate });
    const equipmentWithOrder = Object.assign({}, equipment, {
      nextMaintenanceDate: scheduledDate,
      maintenancePriority: 'immediate',
    }) as EquipmentEntity;
    const harness = makeService({
      current,
      record: Object.assign({}, current, { status: 'completed', completedAt: timestamp }) as MaintenanceEntity,
      equipmentRecord: equipmentWithOrder,
    });

    await harness.service.updateStatus(current.id, 'completed');

    expect(harness.transactionEquipmentRepository.update).toHaveBeenCalledWith(equipment.id, {
      nextMaintenanceDate: null,
      maintenancePriority: 'normal',
    });
  });

  it('clears the projected maintenance summary when the only order is cancelled', async () => {
    const scheduledDate = addCalendarDays(operationalDateKey(), -1);
    const current = maintenanceRecord({ status: 'scheduled', priority: 'immediate', scheduledDate });
    const equipmentWithOrder = Object.assign({}, equipment, {
      nextMaintenanceDate: scheduledDate,
      maintenancePriority: 'immediate',
    }) as EquipmentEntity;
    const harness = makeService({
      current,
      record: Object.assign({}, current, { status: 'cancelled' }) as MaintenanceEntity,
      equipmentRecord: equipmentWithOrder,
    });

    await harness.service.updateStatus(current.id, 'cancelled');

    expect(harness.transactionEquipmentRepository.update).toHaveBeenCalledWith(equipment.id, {
      nextMaintenanceDate: null,
      maintenancePriority: 'normal',
    });
  });

  it('preserves an independent inventory schedule when it differs from a completed work order', async () => {
    const current = maintenanceRecord({ status: 'in_progress', scheduledDate: '2026-10-20' });
    const inventorySchedule = Object.assign({}, equipment, {
      nextMaintenanceDate: '2026-11-20',
      maintenancePriority: 'high',
    }) as EquipmentEntity;
    const harness = makeService({
      current,
      record: Object.assign({}, current, { status: 'completed', completedAt: timestamp }) as MaintenanceEntity,
      equipmentRecord: inventorySchedule,
    });

    await harness.service.updateStatus(current.id, 'completed');

    expect(harness.transactionEquipmentRepository.update).not.toHaveBeenCalled();
  });

  it('recalculates equipment maintenance fields from other active orders', async () => {
    const current = maintenanceRecord({ status: 'in_progress', priority: 'immediate' });
    const remaining = maintenanceRecord({ id: 'maintenance-2', status: 'scheduled', priority: 'high', scheduledDate: addCalendarDays(operationalDateKey(), 4) });
    const harness = makeService({
      current,
      activeMaintenances: [remaining],
      record: Object.assign({}, current, { status: 'completed', completedAt: timestamp }) as MaintenanceEntity,
    });

    await harness.service.updateStatus(current.id, 'completed');

    expect(harness.transactionEquipmentRepository.update).toHaveBeenCalledWith(equipment.id, {
      nextMaintenanceDate: remaining.scheduledDate,
      maintenancePriority: 'high',
    });
  });

  it('does not rewrite a record when it already has the requested status', async () => {
    const current = maintenanceRecord();
    const harness = makeService({ current });

    await harness.service.updateStatus(current.id, 'scheduled');

    expect(harness.transactionRepository.save).not.toHaveBeenCalled();
    expect(harness.monitoringWrite.publish).toHaveBeenCalledWith([]);
  });

  it('rejects transitions from terminal states and missing records', async () => {
    const terminal = makeService({ current: maintenanceRecord({ status: 'completed' }) });
    await expect(terminal.service.updateStatus('maintenance-1', 'scheduled')).rejects.toBeInstanceOf(ConflictException);

    const missing = makeService({ current: null });
    await expect(missing.service.updateStatus('missing', 'completed')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a contract whose equipment type relation is incomplete', async () => {
    const harness = makeService({ record: maintenanceRecord({ equipment: Object.assign({}, equipment, { type: undefined }) as unknown as EquipmentEntity }) });

    await expect(harness.service.create(input())).rejects.toThrow('Maintenance equipment relation is incomplete');
  });
});
