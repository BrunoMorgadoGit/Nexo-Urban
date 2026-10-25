import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { AgentContract } from '@fogo/contracts';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { AgentPositionEntity } from '../locations/agent-position.entity.js';
import { OrganizationEntity } from '../organizations/organization.entity.js';
import { RegionEntity } from '../regions/region.entity.js';
import { MonitoringWriteService } from '../monitoring/monitoring-write.service.js';
import { AgentEntity } from './agent.entity.js';
import { OperationalBaseEntity } from './operational-base.entity.js';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { AgentsService } from './agents.service.js';
import type { CreateAgentDto } from './dto/create-agent.dto.js';

const timestamp = new Date('2026-10-20T10:00:00.000Z');
const organization = { id: 'org-1', name: 'Mobilidade', isActive: true } as OrganizationEntity;
const region = { id: 'region-1', name: 'Centro' } as RegionEntity;

function agentRecord(overrides: Partial<AgentEntity> = {}): AgentEntity {
  return {
    id: 'agent-1', name: 'Equipe Alfa', identifier: 'EQ-01', category: 'traffic_agent',
    organizationId: organization.id, organization, availability: 'available', dataOrigin: 'manual',
    position: null, operationalBaseId: null, operationalBase: null, equipmentId: null, linkedEquipment: null,
    operationalNotes: null, createdAt: timestamp, updatedAt: timestamp, ...overrides,
  } as AgentEntity;
}

const input = (overrides: Partial<CreateAgentDto> = {}): CreateAgentDto => ({
  name: ' Equipe Alfa ', identifier: ' eq-01 ', category: 'traffic_agent',
  organizationId: organization.id, availability: 'available', ...overrides,
}) as CreateAgentDto;

function queryBuilder(overrides: Record<string, unknown> = {}) {
  const builder = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(null),
    getExists: vi.fn().mockResolvedValue(false),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
  return builder;
}

function makeService(options: {
  org?: OrganizationEntity | null;
  foundRegion?: RegionEntity | null;
  foundBase?: OperationalBaseEntity | null;
  foundEquipment?: EquipmentEntity | null;
  duplicate?: boolean;
  current?: AgentEntity | null;
  existingPosition?: AgentPositionEntity | null;
  record?: AgentEntity | null;
  query?: ReturnType<typeof queryBuilder>;
} = {}) {
  const builder = options.query ?? queryBuilder({ getOne: vi.fn().mockResolvedValue(options.record ?? null) });
  const agentRepository = {
    exists: vi.fn().mockResolvedValue(options.duplicate ?? false),
    findOne: vi.fn().mockResolvedValue(options.current ?? null),
    createQueryBuilder: vi.fn().mockReturnValue(builder),
  };
  const organizationRepository = { findOne: vi.fn().mockResolvedValue(options.org === undefined ? organization : options.org) };
  const regionRepository = { findOne: vi.fn().mockResolvedValue(options.foundRegion === undefined ? region : options.foundRegion) };
  const base = { id: 'base-1', name: 'Base Centro', regionId: region.id, region, latitude: -22.9, longitude: -47.0, updatedAt: timestamp } as OperationalBaseEntity;
  const baseRepository = {
    findOne: vi.fn().mockResolvedValue(options.foundBase === undefined ? base : options.foundBase),
    createQueryBuilder: vi.fn(() => queryBuilder({ getMany: vi.fn().mockResolvedValue([base]) })),
  };
  const equipment = { id: 'equipment-1', serialNumber: 'VT-01', brand: 'Marca', model: 'Viatura', typeCode: 'vehicle', type: { label: 'Viatura' } } as EquipmentEntity;
  const equipmentRepository = { findOne: vi.fn().mockResolvedValue(options.foundEquipment === undefined ? equipment : options.foundEquipment) };
  const persisted = agentRecord();
  const positionRepository = {
    save: vi.fn(async (values: unknown) => values),
    findOne: vi.fn().mockResolvedValue(options.existingPosition ?? null),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const transactionBaseRepository = {
    create: vi.fn((values: Partial<OperationalBaseEntity>) => values),
    save: vi.fn(async (values: Partial<OperationalBaseEntity>) => Object.assign({}, base, values)),
  };
  const transactionAgentRepository = {
    create: vi.fn((values: Partial<AgentEntity>) => values),
    save: vi.fn(async (values: Partial<AgentEntity>) => Object.assign({}, persisted, values)),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const manager = {
    getRepository: vi.fn((entity: unknown) => entity === AgentEntity ? transactionAgentRepository
      : entity === AgentPositionEntity ? positionRepository
        : entity === OperationalBaseEntity ? transactionBaseRepository : equipmentRepository),
  };
  const dataSource = {
    getRepository: vi.fn((entity: unknown) => entity === RegionEntity ? regionRepository
      : entity === OperationalBaseEntity ? baseRepository : equipmentRepository),
    transaction: vi.fn(async (operation: (manager: EntityManager) => unknown) => operation(manager as unknown as EntityManager)),
  };
  const monitoringWrite = {
    agentChanged: vi.fn().mockResolvedValue([]),
    agentDeleted: vi.fn().mockResolvedValue({ id: 'event-1' }),
    publish: vi.fn(),
  };
  const service = new AgentsService(
    dataSource as unknown as DataSource,
    agentRepository as unknown as Repository<AgentEntity>,
    positionRepository as unknown as Repository<AgentPositionEntity>,
    organizationRepository as unknown as Repository<OrganizationEntity>,
    monitoringWrite as unknown as MonitoringWriteService,
  );
  return { service, agentRepository, organizationRepository, regionRepository, baseRepository, equipmentRepository, transactionAgentRepository, transactionBaseRepository, positionRepository, manager, dataSource, monitoringWrite, builder };
}

describe('AgentsService', () => {
  it('normalizes identity fields and creates an agent without a GPS position', async () => {
    const harness = makeService();
    vi.spyOn(harness.service, 'get').mockResolvedValue({ id: 'agent-1' } as AgentContract);

    await expect(harness.service.create(input())).resolves.toEqual({ id: 'agent-1' });

    expect(harness.transactionAgentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Equipe Alfa', identifier: 'EQ-01', organizationId: organization.id,
    }));
    expect(harness.positionRepository.save).not.toHaveBeenCalled();
    expect(harness.monitoringWrite.agentChanged).toHaveBeenCalledOnce();
    expect(harness.monitoringWrite.publish).toHaveBeenCalledWith([]);
  });

  it('saves a GPS position with its validated region during creation', async () => {
    const harness = makeService();
    vi.spyOn(harness.service, 'get').mockResolvedValue({ id: 'agent-1' } as AgentContract);
    const position = { latitude: -22.9, longitude: -47.0, recordedAt: timestamp.toISOString(), regionId: region.id };

    await harness.service.create(input({ position }));

    expect(harness.regionRepository.findOne).toHaveBeenCalledWith({ where: { id: region.id } });
    expect(harness.positionRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      agentId: 'agent-1', regionId: region.id, recordedAt: timestamp,
    }));
  });

  it('creates an operational base inline and links an existing equipment record', async () => {
    const harness = makeService();
    vi.spyOn(harness.service, 'get').mockResolvedValue({ id: 'agent-1' } as AgentContract);

    await harness.service.create(input({
      category: 'military_police_officer',
      newOperationalBase: { name: ' Base Centro ', regionId: region.id, latitude: -22.9, longitude: -47.0 },
      equipmentId: 'equipment-1',
      operationalNotes: '  Plantão diurno  ',
    }));

    expect(harness.transactionBaseRepository.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Base Centro', regionId: region.id }));
    expect(harness.transactionAgentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      category: 'military_police_officer', equipmentId: 'equipment-1', operationalNotes: 'Plantão diurno',
    }));
    expect(harness.equipmentRepository.findOne).toHaveBeenCalledWith({ where: { id: 'equipment-1' } });
  });

  it('rejects an incomplete base coordinate pair and an unknown equipment link', async () => {
    const incomplete = makeService();
    await expect(incomplete.service.create(input({
      newOperationalBase: { name: 'Base Centro', latitude: -22.9 },
    }))).rejects.toBeInstanceOf(BadRequestException);
    expect(incomplete.dataSource.transaction).not.toHaveBeenCalled();

    const unknownEquipment = makeService({ foundEquipment: null });
    await expect(unknownEquipment.service.create(input({ equipmentId: 'missing-equipment' }))).rejects.toBeInstanceOf(BadRequestException);
    expect(unknownEquipment.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects conflicting or unknown operational base references', async () => {
    const conflicting = makeService();
    await expect(conflicting.service.create(input({
      operationalBaseId: 'base-1', newOperationalBase: { name: 'Nova base' },
    }))).rejects.toBeInstanceOf(BadRequestException);

    const invalidRegion = makeService({ foundRegion: null });
    await expect(invalidRegion.service.create(input({
      newOperationalBase: { name: 'Nova base', regionId: region.id },
    }))).rejects.toBeInstanceOf(BadRequestException);

    const invalidBase = makeService({ foundBase: null });
    await expect(invalidBase.service.create(input({ operationalBaseId: 'missing-base' }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive or unknown organization before opening a transaction', async () => {
    const harness = makeService({ org: null });

    await expect(harness.service.create(input())).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a position referencing a missing region', async () => {
    const harness = makeService({ foundRegion: null });
    const position = { latitude: -22.9, longitude: -47.0, recordedAt: timestamp.toISOString(), regionId: region.id };

    await expect(harness.service.create(input({ position }))).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a duplicate normalized identifier', async () => {
    const harness = makeService({ duplicate: true });

    await expect(harness.service.create(input())).rejects.toBeInstanceOf(ConflictException);
    expect(harness.agentRepository.exists).toHaveBeenCalledWith({ where: { identifier: 'EQ-01' } });
  });

  it('applies search, category, availability, organization and pagination filters to list', async () => {
    const builder = queryBuilder({ getManyAndCount: vi.fn().mockResolvedValue([[agentRecord()], 3]) });
    const harness = makeService({ query: builder });
    const result = await harness.service.list({
      page: 2, pageSize: 1, search: '  Alfa ', category: 'traffic_agent',
      availability: 'available', organizationId: organization.id,
    });

    expect(builder.andWhere).toHaveBeenCalledTimes(4);
    expect(builder.andWhere).toHaveBeenCalledWith(
      '(agent.name ILIKE :search OR agent.identifier ILIKE :search OR organization.name ILIKE :search)',
      { search: '%Alfa%' },
    );
    expect(builder.skip).toHaveBeenCalledWith(1);
    expect(builder.take).toHaveBeenCalledWith(1);
    expect(result).toMatchObject({ page: 2, pageSize: 1, total: 3, totalPages: 3 });
    expect(result.items[0]).toMatchObject({ name: 'Equipe Alfa', organizationName: 'Mobilidade', position: null });
  });

  it('uses default paging and maps an empty list', async () => {
    const builder = queryBuilder();
    const harness = makeService({ query: builder });

    await expect(harness.service.list({})).resolves.toMatchObject({ items: [], page: 1, pageSize: 20, totalPages: 0 });
    expect(builder.andWhere).not.toHaveBeenCalled();
    expect(builder.skip).toHaveBeenCalledWith(0);
    expect(builder.take).toHaveBeenCalledWith(20);
  });

  it('maps stored GPS details and nullable region names when reading an agent', async () => {
    const position = {
      latitude: -22.9, longitude: -47.0, regionId: region.id, recordedAt: timestamp, region: null,
    } as AgentPositionEntity;
    const harness = makeService({ record: agentRecord({ position }) });

    await expect(harness.service.get('agent-1')).resolves.toMatchObject({
      position: { latitude: -22.9, longitude: -47.0, recordedAt: timestamp.toISOString(), regionId: region.id, regionName: null },
    });
    expect(harness.builder.where).toHaveBeenCalledWith('agent.id = :id', { id: 'agent-1' });
  });

  it('returns not found when the agent does not exist', async () => {
    const harness = makeService();

    await expect(harness.service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps the agent deletion event and publishes it after deletion', async () => {
    const harness = makeService({ current: agentRecord() });

    await expect(harness.service.delete('agent-1')).resolves.toBeUndefined();

    expect(harness.transactionAgentRepository.delete).toHaveBeenCalledWith({ id: 'agent-1' });
    expect(harness.monitoringWrite.agentDeleted).toHaveBeenCalledWith(harness.manager, 'agent-1', 'EQ-01');
    expect(harness.monitoringWrite.publish).toHaveBeenCalledWith([{ id: 'event-1' }]);
  });

  it('returns not found when deleting an unknown agent', async () => {
    const harness = makeService();

    await expect(harness.service.delete('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(harness.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('returns selectable operational bases with region names', async () => {
    const harness = makeService();

    await expect(harness.service.listOperationalBases()).resolves.toEqual([{
      id: 'base-1', name: 'Base Centro', regionId: region.id, regionName: 'Centro', latitude: -22.9, longitude: -47.0,
    }]);
  });

  it('rejects an incomplete organization relation instead of returning a partial contract', async () => {
    const harness = makeService({ record: agentRecord({ organization: undefined as unknown as OrganizationEntity }) });

    await expect(harness.service.get('agent-1')).rejects.toThrow('Agent organization relation is incomplete');
  });

  it('updates normalized agent fields and saves a new position', async () => {
    const harness = makeService({ current: agentRecord() });
    vi.spyOn(harness.service, 'get').mockResolvedValue({ id: 'agent-1', identifier: 'EQ-02' } as AgentContract);
    const position = { latitude: -22.9, longitude: -47.0, recordedAt: timestamp.toISOString(), regionId: region.id };

    await expect(harness.service.update('agent-1', input({ identifier: ' eq-02 ', position }))).resolves.toMatchObject({ identifier: 'EQ-02' });

    expect(harness.transactionAgentRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'agent-1', name: 'Equipe Alfa', identifier: 'EQ-02',
    }));
    expect(harness.positionRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      agentId: 'agent-1', regionId: region.id, recordedAt: timestamp,
    }));
    expect(harness.monitoringWrite.publish).toHaveBeenCalledWith([]);
  });

  it('removes the previous GPS position when an update omits position data', async () => {
    const oldPosition = { id: 'position-1', agentId: 'agent-1' } as AgentPositionEntity;
    const harness = makeService({ current: agentRecord(), existingPosition: oldPosition });
    vi.spyOn(harness.service, 'get').mockResolvedValue({ id: 'agent-1', position: null } as AgentContract);

    await harness.service.update('agent-1', input());

    expect(harness.positionRepository.remove).toHaveBeenCalledWith(oldPosition);
    expect(harness.positionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects updates for missing agents and duplicate identifiers', async () => {
    const missing = makeService();
    await expect(missing.service.update('missing', input())).rejects.toBeInstanceOf(NotFoundException);

    const duplicate = makeService({
      current: agentRecord(),
      query: queryBuilder({ getExists: vi.fn().mockResolvedValue(true) }),
    });
    await expect(duplicate.service.update('agent-1', input({ identifier: 'EQ-02' }))).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects updates when the responsible organization is unavailable', async () => {
    const harness = makeService({ current: agentRecord(), org: null });

    await expect(harness.service.update('agent-1', input())).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.dataSource.transaction).not.toHaveBeenCalled();
  });
});
