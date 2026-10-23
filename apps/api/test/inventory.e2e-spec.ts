import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AgentEntity } from '../src/agents/agent.entity.js';
import { AppModule } from '../src/app.module.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { EquipmentEntity } from '../src/equipment/equipment.entity.js';
import { MaintenanceEntity } from '../src/maintenance/maintenance.entity.js';
import { OrganizationEntity } from '../src/organizations/organization.entity.js';
import { RegionEntity } from '../src/regions/region.entity.js';

describe('Inventory API (e2e, PostgreSQL)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let organizationId: string;
  let regionId: string;
  let serialNumber: string;
  let agentIdentifier: string;
  let equipmentId: string;
  let mobileEquipmentId: string;
  let agentId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
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
      for (const id of [equipmentId, mobileEquipmentId].filter((value): value is string => Boolean(value))) {
        await dataSource.getRepository(MaintenanceEntity).delete({ equipmentId: id });
        await dataSource.getRepository(EquipmentEntity).delete({ id });
      }
      if (agentId) await dataSource.getRepository(AgentEntity).delete({ id: agentId });
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
      .send({ ...input, lastPosition: { latitude: -22.906, longitude: -47.061, recordedAt: new Date().toISOString() } })
      .expect(201);
    mobileEquipmentId = response.body.id as string;
    expect(response.body.location.role).toBe('base');
    expect(response.body.lastPosition.latitude).toBeCloseTo(-22.906);
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
        position: { latitude: -22.9056, longitude: -47.0608, recordedAt: new Date().toISOString() },
      })
      .expect(201);
    agentId = response.body.id as string;
    expect(response.body.identifier).toBe(agentIdentifier);
    expect(response.body.position.latitude).toBeCloseTo(-22.9056);
    const page = await request(app.getHttpServer())
      .get('/api/v1/agents')
      .query({ search: agentIdentifier, page: 1, pageSize: 10 })
      .expect(200);
    expect(page.body.items[0].id).toBe(agentId);
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

  it('identifies overdue and upcoming maintenance and enforces lifecycle transitions', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
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
