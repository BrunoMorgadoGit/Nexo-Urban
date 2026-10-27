import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { In } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AgentEntity } from '../src/agents/agent.entity.js';
import { OperationalBaseEntity } from '../src/agents/operational-base.entity.js';
import { AppModule } from '../src/app.module.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { addCalendarDays, operationalDateKey } from '../src/common/operational-date.js';
import { EquipmentEntity } from '../src/equipment/equipment.entity.js';
import { EquipmentLocationEntity } from '../src/locations/equipment-location.entity.js';
import { MaintenanceEntity } from '../src/maintenance/maintenance.entity.js';
import { OrganizationEntity } from '../src/organizations/organization.entity.js';
import { RegionEntity } from '../src/regions/region.entity.js';
import { OperationalAlertEntity } from '../src/monitoring/operational-alert.entity.js';
import { OperationalEventEntity } from '../src/monitoring/operational-event.entity.js';
import { MonitoringWriteService } from '../src/monitoring/monitoring-write.service.js';

describe('Inventory API (e2e, PostgreSQL)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let organizationId: string;
  let regionId: string;
  let serialNumber: string;
  let agentIdentifier: string;
  let equipmentId: string;
  let crossCityEquipmentId: string;
  let mobileEquipmentId: string;
  let agentId: string;
  let unlocatedAgentId: string;
  let linkedAgentId: string;
  let operationalBaseId: string;
  const maintenanceIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.listen(0, '127.0.0.1');
    dataSource = app.get(DataSource);
    const organization = await dataSource.getRepository(OrganizationEntity).findOneByOrFail({ code: 'mobilidade-demo' });
    const region = await dataSource.getRepository(RegionEntity).findOneByOrFail({ code: 'centro' });
    organizationId = organization.id;
    regionId = region.id;
    serialNumber = `E2E-${randomUUID().slice(0, 12).toUpperCase()}`;
    agentIdentifier = `E2E-${randomUUID().slice(0, 12).toUpperCase()}`;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      for (const id of [equipmentId, crossCityEquipmentId, mobileEquipmentId].filter((value): value is string => Boolean(value))) {
        await dataSource.getRepository(MaintenanceEntity).delete({ equipmentId: id });
        await dataSource.getRepository(EquipmentEntity).delete({ id });
      }
      for (const id of maintenanceIds) await dataSource.getRepository(MaintenanceEntity).delete({ id });
      const resourceIds = [equipmentId, crossCityEquipmentId, mobileEquipmentId, agentId, unlocatedAgentId, linkedAgentId, ...maintenanceIds]
        .filter((value): value is string => Boolean(value));
      const relatedAlerts = resourceIds.length
        ? await dataSource.getRepository(OperationalAlertEntity).find({ where: { resourceId: In(resourceIds) } })
        : [];
      const eventResourceIds = [...resourceIds, ...relatedAlerts.map(({ id }) => id)];
      if (eventResourceIds.length) {
        await dataSource.getRepository(OperationalEventEntity).delete({ resourceId: In(eventResourceIds) });
        await dataSource.getRepository(OperationalAlertEntity).delete({ resourceId: In(resourceIds) });
      }
      if (agentId) await dataSource.getRepository(AgentEntity).delete({ id: agentId });
      if (unlocatedAgentId) await dataSource.getRepository(AgentEntity).delete({ id: unlocatedAgentId });
      if (linkedAgentId) await dataSource.getRepository(AgentEntity).delete({ id: linkedAgentId });
      if (operationalBaseId) await dataSource.getRepository(OperationalBaseEntity).delete({ id: operationalBaseId });
    }
    await app?.close();
  });

  function equipmentInput(serial = serialNumber) {
    return {
      typeCode: 'speed_radar',
      serialNumber: serial,
      brand: 'F.O.G.O. Teste',
      model: 'Radar demonstrativo',
      organizationId,
      status: 'operational',
      maintenancePriority: 'normal',
      nextMaintenanceDate: '2026-11-10',
      characteristics: { speedLimitKmh: 50, lanes: 2, technology: 'doppler' },
      location: {
        postalCode: '13000-000',
        street: 'Avenida de Teste',
        reference: 'número 10',
        regionId,
        city: 'Campinas',
        state: 'SP',
        latitude: -22.9056,
        longitude: -47.0608,
        role: 'fixed',
      },
    };
  }

  it('creates an equipment record and persists it in PostgreSQL', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/equipments')
      .send(equipmentInput())
      .expect(201);
    equipmentId = response.body.id as string;
    expect(response.body.serialNumber).toBe(serialNumber);
    expect(response.body.typeLabel).toBe('Radar de velocidade');
    expect(response.body.location.role).toBe('fixed');
    const persisted = await dataSource.getRepository(EquipmentEntity).findOneByOrFail({ id: equipmentId });
    expect(persisted.characteristics).toEqual({ speedLimitKmh: 50, lanes: 2, technology: 'doppler' });
  });

  it('persists the address city and state instead of overwriting them with the region city', async () => {
    const input = equipmentInput(`E2E-${randomUUID().slice(0, 12).toUpperCase()}`);
    input.location.city = 'São Paulo';
    const response = await request(app.getHttpServer())
      .post('/api/v1/equipments')
      .send(input)
      .expect(201);
    crossCityEquipmentId = response.body.id as string;
    expect(response.body.location.city).toBe('São Paulo');
    expect(response.body.location.state).toBe('SP');
    const persisted = await dataSource
      .getRepository(EquipmentLocationEntity)
      .findOneByOrFail({ equipmentId: crossCityEquipmentId });
    expect(persisted.city).toBe('São Paulo');
    expect(persisted.state).toBe('SP');
  });

  it('rolls back the resource when recording its operational event fails', async () => {
    const rollbackSerial = `E2E-ROLLBACK-${randomUUID().slice(0, 8).toUpperCase()}`;
    const appendEvent = vi.spyOn(app.get(MonitoringWriteService), 'appendEvent')
      .mockRejectedValueOnce(new Error('Injected event persistence failure'));
    try {
      await request(app.getHttpServer())
        .post('/api/v1/equipments')
        .send(equipmentInput(rollbackSerial))
        .expect(500);
    } finally {
      appendEvent.mockRestore();
    }
    expect(await dataSource.getRepository(EquipmentEntity).exists({ where: { serialNumber: rollbackSerial } })).toBe(false);
  });

  it('rolls back equipment when operational event persistence fails', async () => {
    const rollbackSerial = `E2E-ROLLBACK-${randomUUID().slice(0, 8).toUpperCase()}`;
    const appendEvent = vi.spyOn(app.get(MonitoringWriteService), 'appendEvent')
      .mockRejectedValueOnce(new Error('Injected event persistence failure'));
    try {
      await request(app.getHttpServer())
        .post('/api/v1/equipments')
        .send(equipmentInput(rollbackSerial))
        .expect(500);
    } finally {
      appendEvent.mockRestore();
    }
    expect(await dataSource.getRepository(EquipmentEntity).exists({ where: { serialNumber: rollbackSerial } })).toBe(false);
  });

  it('rejects invalid DTOs and type characteristics without saving equipment', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/equipments')
      .send({ ...equipmentInput(), status: 'unknown' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/equipments')
      .send({ ...equipmentInput(), serialNumber: `${serialNumber}-BAD`, characteristics: { speedLimitKmh: 50, lanes: 2, technology: 'doppler', freeField: 'no' } })
      .expect(400);
  });

  it('enforces serial uniqueness and returns a conflict', async () => {
    await request(app.getHttpServer()).post('/api/v1/equipments').send(equipmentInput()).expect(409);
    await request(app.getHttpServer())
      .post('/api/v1/equipments')
      .send(equipmentInput(serialNumber.toLowerCase()))
      .expect(409);
  });

  it('keeps mobile base address separate from the required last known GPS position', async () => {
    const serial = `${serialNumber}-MOBILE`;
    const input = {
      ...equipmentInput(serial),
      typeCode: 'scooter',
      characteristics: { batteryCapacityWh: 500, topSpeedKmh: 25 },
      location: { ...equipmentInput(serial).location, role: 'base' },
    };
    await request(app.getHttpServer()).post('/api/v1/equipments').send(input).expect(400);
    const response = await request(app.getHttpServer())
      .post('/api/v1/equipments')
      .send({ ...input, lastPosition: { latitude: -22.906, longitude: -47.061, recordedAt: new Date(Date.now() - 90 * 60_000).toISOString() } })
      .expect(201);
    mobileEquipmentId = response.body.id as string;
    expect(response.body.location.role).toBe('base');
    expect(response.body.lastPosition.latitude).toBeCloseTo(-22.906);
    const map = await request(app.getHttpServer())
      .get('/api/v1/monitoring/map')
      .query({ resourceType: 'equipment', typeCode: 'scooter', regionId })
      .expect(200);
    expect(map.body.items.find((item: { id: string }) => item.id === mobileEquipmentId).positionStale).toBe(true);
  });

  it('supports detail, filters, pagination and operational state updates', async () => {
    const detail = await request(app.getHttpServer()).get(`/api/v1/equipments/${equipmentId}`).expect(200);
    expect(detail.body.id).toBe(equipmentId);
    const page = await request(app.getHttpServer())
      .get('/api/v1/equipments')
      .query({ search: serialNumber, regionId, page: 1, pageSize: 1 })
      .expect(200);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.total).toBeGreaterThanOrEqual(1);
    await request(app.getHttpServer())
      .put(`/api/v1/equipments/${equipmentId}`)
      .send({ ...equipmentInput(), status: 'malfunctioning', maintenancePriority: 'high' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('malfunctioning');
        expect(body.maintenancePriority).toBe('high');
      });
  });

  it('creates one persisted alert per active condition, keeps acknowledgement visible, then resolves on normalization', async () => {
    const alerts = dataSource.getRepository(OperationalAlertEntity);
    const activeResponse = await request(app.getHttpServer())
      .get('/api/v1/monitoring/alerts')
      .query({ resourceId: equipmentId, status: 'active' })
      .expect(200);
    const alert = activeResponse.body.items.find((item: { code: string }) => item.code === 'equipment_malfunctioning') as { id: string; actions: Array<{ type: string }> } | undefined;
    expect(alert).toBeTruthy();
    expect(activeResponse.body.items.filter((item: { code: string }) => item.code === 'equipment_malfunctioning')).toHaveLength(1);
    expect(await alerts.findOneByOrFail({ id: alert!.id })).toMatchObject({ status: 'open', severity: 'critical' });

    await request(app.getHttpServer()).post(`/api/v1/monitoring/alerts/${alert!.id}/acknowledge`).expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/monitoring/alerts')
      .query({ resourceId: equipmentId, status: 'active' })
      .expect(200)
      .expect(({ body }) => expect(body.items.some((item: { id: string; status: string }) => item.id === alert!.id && item.status === 'acknowledged')).toBe(true));
    await request(app.getHttpServer())
      .post(`/api/v1/monitoring/alerts/${alert!.id}/notes`)
      .send({ note: 'Equipe avisada e condição confirmada no local.' })
      .expect(201)
      .expect(({ body }) => expect(body.actions.some((action: { type: string; note: string }) => action.type === 'note' && action.note.includes('Equipe'))).toBe(true));
    await request(app.getHttpServer()).post(`/api/v1/monitoring/alerts/${alert!.id}/resolve`).expect(409);

    const cursor = await dataSource.getRepository(OperationalEventEntity)
      .createQueryBuilder('event').orderBy('event.id', 'DESC').getOne();
    const events: string[] = [];
    const subscription = app.get(MonitoringWriteService).events$.subscribe((event) => events.push(event.type));
    await request(app.getHttpServer())
      .put(`/api/v1/equipments/${equipmentId}`)
      .send({ ...equipmentInput(), status: 'operational', maintenancePriority: 'normal' })
      .expect(200);
    subscription.unsubscribe();
    expect(events).toContain('alert.resolved');
    const resolved = await request(app.getHttpServer())
      .get('/api/v1/monitoring/alerts')
      .query({ resourceId: equipmentId, status: 'resolved' })
      .expect(200);
    expect(resolved.body.items.find((item: { id: string }) => item.id === alert!.id)?.actions.map((action: { type: string }) => action.type))
      .toEqual(['created', 'acknowledged', 'note', 'resolved']);

    if (cursor) {
      const address = app.getHttpServer().address() as { port: number };
      const abort = new AbortController();
      try {
        const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/monitoring/events/stream?since=${cursor.id}`, { signal: abort.signal });
        expect(response.status).toBe(200);
        const reader = response.body?.getReader();
        expect(reader).toBeDefined();
        let content = '';
        const deadline = Date.now() + 5000;
        while (!content.includes('event: alert.resolved') && Date.now() < deadline) {
          const result = await reader!.read();
          if (result.done) break;
          content += new TextDecoder().decode(result.value);
        }
        expect(content).toContain('event: alert.resolved');
        expect(content).toContain('source');
        await reader?.cancel();
      } finally {
        abort.abort();
      }
    }
  });

  it('serves database-backed monitoring indicators and filters map resources by neighborhood and region', async () => {
    const [overview, map, regions] = await Promise.all([
      request(app.getHttpServer()).get('/api/v1/monitoring/overview').expect(200),
      request(app.getHttpServer()).get('/api/v1/monitoring/map').query({ resourceType: 'equipment', typeCode: 'speed_radar', regionId }).expect(200),
      request(app.getHttpServer()).get('/api/v1/monitoring/regions').expect(200),
    ]);
    expect(overview.body.totalEquipment).toBeGreaterThanOrEqual(1);
    expect(overview.body.eligibleEquipment).toBeLessThanOrEqual(overview.body.totalEquipment);
    expect(map.body.items.some((item: { id: string }) => item.id === equipmentId)).toBe(true);
    const neighborhood = regions.body.find((region: { id: string }) => region.id === regionId);
    expect(neighborhood.registeredEquipment).toBeGreaterThanOrEqual(1);
    const regionalMap = await request(app.getHttpServer())
      .get('/api/v1/monitoring/map')
      .query({ resourceType: 'equipment', typeCode: 'speed_radar', regionZone: neighborhood.zone })
      .expect(200);
    expect(regionalMap.body.items.some((item: { id: string }) => item.id === equipmentId)).toBe(true);
    expect(regionalMap.body.items.every((item: { regionZone: string }) => item.regionZone === neighborhood.zone)).toBe(true);
  });

  it('lists the registered type schemas and summary counters', async () => {
    const [types, summary] = await Promise.all([
      request(app.getHttpServer()).get('/api/v1/equipment-types').expect(200),
      request(app.getHttpServer()).get('/api/v1/inventory/summary').expect(200),
    ]);
    expect(types.body).toHaveLength(10);
    expect(types.body.find((type: { code: string }) => type.code === 'scooter').characteristics.length).toBeGreaterThan(0);
    expect(summary.body.totalEquipment).toBeGreaterThan(0);
    expect(summary.body.overdueMaintenance).toBeGreaterThanOrEqual(0);
  });

  it('registers and queries an operational agent', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agents')
      .send({
        name: 'Agente de Teste Demonstrativo',
        identifier: agentIdentifier.toLowerCase(),
        category: 'traffic_agent',
        organizationId,
        availability: 'available',
        position: { latitude: -22.9056, longitude: -47.0608, recordedAt: new Date().toISOString(), regionId },
      })
      .expect(201);
    agentId = response.body.id as string;
    expect(response.body.identifier).toBe(agentIdentifier);
    expect(response.body.position.latitude).toBeCloseTo(-22.9056);
    expect(response.body.position.regionName).toBe('Centro');
    const page = await request(app.getHttpServer())
      .get('/api/v1/agents')
      .query({ search: agentIdentifier, page: 1, pageSize: 10 })
      .expect(200);
    expect(page.body.items[0].id).toBe(agentId);

    const noPosition = await request(app.getHttpServer())
      .post('/api/v1/agents')
      .send({ name: 'Agente sem posição de teste', identifier: `${agentIdentifier}-NP`, category: 'municipal_guard', organizationId, availability: 'available' })
      .expect(201);
    unlocatedAgentId = noPosition.body.id as string;
    const map = await request(app.getHttpServer()).get('/api/v1/monitoring/map').query({ resourceType: 'agent' }).expect(200);
    expect(map.body.items.some((item: { id: string }) => item.id === unlocatedAgentId)).toBe(false);
    expect(map.body.withoutPosition).toBeGreaterThanOrEqual(1);
    await request(app.getHttpServer())
      .post('/api/v1/agents')
      .send({
        name: 'Agente de Teste Demonstrativo',
        identifier: agentIdentifier,
        category: 'traffic_agent',
        organizationId,
        availability: 'available',
      })
      .expect(409);
  });

  it('links agents to reusable bases and existing equipment, maps the location source accurately, updates and deletes', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/agents')
      .send({
        name: 'Policial Civil de Teste',
        identifier: `${agentIdentifier}-LINK`,
        category: 'civil_police_officer',
        organizationId,
        availability: 'on_duty',
        newOperationalBase: { name: 'Base E2E', regionId, latitude: -22.9056, longitude: -47.0608 },
        equipmentId: mobileEquipmentId,
        operationalNotes: 'Turno da manhã',
      })
      .expect(201);
    linkedAgentId = created.body.id as string;
    operationalBaseId = created.body.operationalBase.id as string;
    expect(created.body).toMatchObject({
      category: 'civil_police_officer',
      operationalNotes: 'Turno da manhã',
      operationalBase: { id: operationalBaseId, name: 'Base E2E', regionName: 'Centro' },
      linkedEquipment: { id: mobileEquipmentId },
    });

    const bases = await request(app.getHttpServer()).get('/api/v1/agents/operational-bases').expect(200);
    expect(bases.body.some((base: { id: string }) => base.id === operationalBaseId)).toBe(true);
    const equipmentMap = await request(app.getHttpServer()).get('/api/v1/monitoring/map').query({ resourceType: 'agent' }).expect(200);
    expect(equipmentMap.body.items.find((item: { id: string }) => item.id === linkedAgentId)).toMatchObject({
      positionSource: 'linked_equipment',
      locationDescription: expect.stringContaining('Posição do equipamento'),
    });

    const updated = await request(app.getHttpServer())
      .put(`/api/v1/agents/${linkedAgentId}`)
      .send({
        name: 'Policial Civil de Teste',
        identifier: `${agentIdentifier}-LINK`,
        category: 'civil_police_officer',
        organizationId,
        availability: 'off_duty',
        operationalBaseId,
        equipmentId: null,
        operationalNotes: 'Turno encerrado',
      })
      .expect(200);
    expect(updated.body).toMatchObject({ availability: 'off_duty', linkedEquipment: null, operationalNotes: 'Turno encerrado' });
    const baseMap = await request(app.getHttpServer()).get('/api/v1/monitoring/map').query({ resourceType: 'agent' }).expect(200);
    expect(baseMap.body.items.find((item: { id: string }) => item.id === linkedAgentId)).toMatchObject({
      positionSource: 'agent_base',
      locationDescription: 'Base operacional: Base E2E',
    });

    await request(app.getHttpServer()).delete(`/api/v1/agents/${linkedAgentId}`).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/agents/${linkedAgentId}`).expect(404);
    expect(await dataSource.getRepository(OperationalEventEntity).exists({
      where: { resourceId: linkedAgentId, eventType: 'agent.deleted' },
    })).toBe(true);
  });

  it('identifies overdue and upcoming maintenance and enforces lifecycle transitions', async () => {
    const yesterday = addCalendarDays(operationalDateKey(), -1);
    const response = await request(app.getHttpServer())
      .post('/api/v1/maintenance')
      .send({
        equipmentId,
        kind: 'immediate',
        priority: 'immediate',
        description: 'Verificação de segurança criada no teste integrado.',
        scheduledDate: yesterday,
      })
      .expect(201);
    maintenanceIds.push(response.body.id as string);
    expect(response.body.overdue).toBe(true);
    await request(app.getHttpServer())
      .get('/api/v1/maintenance')
      .query({ equipmentId, overdueOnly: true })
      .expect(200)
      .expect(({ body }) => expect(body.items.some((item: { id: string }) => item.id === response.body.id)).toBe(true));
    await request(app.getHttpServer())
      .patch(`/api/v1/maintenance/${response.body.id}/status`)
      .send({ status: 'in_progress' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/maintenance/${response.body.id}/status`)
      .send({ status: 'completed' })
      .expect(200)
      .expect(({ body }) => expect(body.completedAt).toBeTruthy());
    const maintenanceAlerts = await request(app.getHttpServer()).get('/api/v1/monitoring/alerts')
      .query({ resourceId: response.body.id, status: 'resolved' }).expect(200);
    expect(maintenanceAlerts.body.items.some((alert: { code: string }) => alert.code === 'maintenance_immediate')).toBe(true);
    const overview = await request(app.getHttpServer()).get('/api/v1/maintenance/overview').expect(200);
    expect(overview.body.upcoming).toBeGreaterThanOrEqual(1);
    await request(app.getHttpServer())
      .patch(`/api/v1/maintenance/${response.body.id}/status`)
      .send({ status: 'scheduled' })
      .expect(409);
  });

  it('deactivates rather than deleting an equipment record', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/equipments/${equipmentId}`)
      .expect(200);
    expect(response.body.status).toBe('deactivated');
    expect(await dataSource.getRepository(EquipmentEntity).exists({ where: { id: equipmentId } })).toBe(true);
  });
});
