import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { AppModule } from '../src/app.module.js';
import { EquipmentEntity } from '../src/equipment/equipment.entity.js';
import { OperationalEventEntity } from '../src/monitoring/operational-event.entity.js';

describe('Mission Control demo scenario (e2e, PostgreSQL)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.listen(0, '127.0.0.1');
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    try { await request(app.getHttpServer()).post('/api/v1/monitoring/demo/scenario/reset'); } catch { /* preserve test cleanup */ }
    await app?.close();
  });

  it('persists the incident, prevents duplicates, records acknowledgement and resolves on restoration', async () => {
    try {
      const initialScenario = await request(app.getHttpServer())
        .post('/api/v1/monitoring/demo/scenario/reset').expect(201);
      const before = await request(app.getHttpServer()).get('/api/v1/monitoring/overview').expect(200);

      const outage = await request(app.getHttpServer())
        .post('/api/v1/monitoring/demo/scenario/outage').expect(201);
      expect(outage.body.active).toBe(true);
      expect(outage.body.status).toBe('malfunctioning');
      const repeated = await request(app.getHttpServer())
        .post('/api/v1/monitoring/demo/scenario/outage').expect(201);
      expect(repeated.body.equipmentId).toBe(outage.body.equipmentId);

      const activeAlerts = await request(app.getHttpServer()).get('/api/v1/monitoring/alerts')
        .query({ status: 'active', resourceId: outage.body.equipmentId }).expect(200);
      expect(activeAlerts.body.total).toBe(1);
      const alertId = activeAlerts.body.items[0].id as string;
      await request(app.getHttpServer()).post(`/api/v1/monitoring/alerts/${alertId}/acknowledge`).expect(201);

      const failingOverview = await request(app.getHttpServer()).get('/api/v1/monitoring/overview').expect(200);
      expect(failingOverview.body.unavailableEquipment).toBeGreaterThanOrEqual(before.body.unavailableEquipment + 1);
      const incidentTimeline = await request(app.getHttpServer())
        .get('/api/v1/monitoring/demo/scenario/timeline').expect(200);
      expect(incidentTimeline.body.map((entry: { eventType: string }) => entry.eventType))
        .toEqual(expect.arrayContaining(['demo.scenario.changed', 'alert.created', 'alert.updated']));
      expect(incidentTimeline.body.every((entry: { serialNumber: string }) => entry.serialNumber === initialScenario.body.serialNumber)).toBe(true);
      const timelineTimes = incidentTimeline.body.map((entry: { occurredAt: string }) => Date.parse(entry.occurredAt));
      expect(timelineTimes).toEqual([...timelineTimes].sort((left: number, right: number) => left - right));

      await request(app.getHttpServer()).post('/api/v1/monitoring/demo/scenario/reset').expect(201);
      const resolved = await request(app.getHttpServer()).get('/api/v1/monitoring/alerts')
        .query({ status: 'resolved', resourceId: outage.body.equipmentId }).expect(200);
      expect(resolved.body.items.some((alert: { id: string; actions: Array<{ type: string }> }) =>
        alert.id === alertId && alert.actions.some((action) => action.type === 'acknowledged')
        && alert.actions.some((action) => action.type === 'resolved'))).toBe(true);

      const restoredOverview = await request(app.getHttpServer()).get('/api/v1/monitoring/overview').expect(200);
      expect(restoredOverview.body.operationalEquipment).toBe(before.body.operationalEquipment);
      const timeline = await request(app.getHttpServer()).get('/api/v1/monitoring/demo/scenario/timeline').expect(200);
      expect(timeline.body.map((entry: { eventType: string }) => entry.eventType)).toContain('alert.resolved');
      expect(await dataSource.getRepository(OperationalEventEntity).count({ where: { resourceId: initialScenario.body.equipmentId } })).toBeGreaterThan(0);
      expect(await dataSource.getRepository(EquipmentEntity).findOneByOrFail({ id: initialScenario.body.equipmentId }).then((item) => item.status)).toBe('operational');
    } finally {
      await request(app.getHttpServer()).post('/api/v1/monitoring/demo/scenario/reset');
    }
  });
});
