import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { AppModule } from '../src/app.module.js';
import { IntelligenceAssessmentEntity } from '../src/intelligence/intelligence-assessment.entity.js';
import { IntelligenceRegionAssessmentEntity } from '../src/intelligence/intelligence-region-assessment.entity.js';

describe('Predictive intelligence API (e2e, PostgreSQL)', () => {
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

  afterAll(async () => { await app?.close(); });

  it('serves a persistent explainable snapshot with explicit source provenance', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/intelligence/overview').expect(200);
    expect(response.body.sourceScope).toBe('demo');
    expect(response.body.methodVersion).toBe('risk-rules-v1');
    expect(response.body.horizonHours).toBe(24);
    expect(response.body.sourceComposition.syntheticObservations).toBeGreaterThan(0);
    expect(response.body.highestRiskRegions.length).toBeGreaterThan(0);
    expect(response.body.highestRiskRegions.every((row: { riskScore: number | null; classification: string }) =>
      row.classification === 'insufficient_data' ? row.riskScore === null : typeof row.riskScore === 'number')).toBe(true);
    expect(await dataSource.getRepository(IntelligenceAssessmentEntity).count({ where: { sourceScope: 'demo' } })).toBeGreaterThan(0);
    expect(await dataSource.getRepository(IntelligenceRegionAssessmentEntity).count()).toBeGreaterThan(0);
  });

  it('returns regional factors, chronological trend, maintenance priorities and a bounded retrospective evaluation', async () => {
    const regions = await request(app.getHttpServer()).get('/api/v1/intelligence/regions?sourceScope=demo').expect(200);
    expect(regions.body.length).toBeGreaterThan(0);
    const detail = await request(app.getHttpServer()).get(`/api/v1/intelligence/regions/${regions.body[0].regionId}`).expect(200);
    expect(detail.body.risk.factors.length).toBe(7);
    expect(detail.body.trend.every((point: { referenceAt: string }, index: number, list: Array<{ referenceAt: string }>) =>
      index === 0 || point.referenceAt >= list[index - 1].referenceAt)).toBe(true);
    const priorities = await request(app.getHttpServer()).get('/api/v1/intelligence/maintenance-priorities?sourceScope=demo').expect(200);
    expect(priorities.body.length).toBeGreaterThan(0);
    const trends = await request(app.getHttpServer()).get('/api/v1/intelligence/trends?sourceScope=demo').expect(200);
    expect(trends.body.every((point: { regionId: string; regionName: string }) => point.regionId && point.regionName)).toBe(true);
    const validation = await request(app.getHttpServer()).get('/api/v1/intelligence/validation?sourceScope=demo').expect(200);
    expect(validation.body.sampleWindows).toBeGreaterThan(0);
    expect(validation.body.incidentPrevalence).toBeGreaterThanOrEqual(0);
    expect(validation.body.modelConfusion.truePositives + validation.body.modelConfusion.falsePositives
      + validation.body.modelConfusion.trueNegatives + validation.body.modelConfusion.falseNegatives).toBe(validation.body.sampleWindows);
    expect(validation.body.modelClassificationDistribution.low + validation.body.modelClassificationDistribution.moderate
      + validation.body.modelClassificationDistribution.elevated + validation.body.modelClassificationDistribution.critical)
      .toBe(validation.body.sampleWindows);
    expect(validation.body.precisionAtOne.evaluatedCutoffs).toBeGreaterThan(0);
    expect(validation.body.limitations).toContain('Escores são índices de priorização e não probabilidades calibradas de incidentes.');
  });

  it('rejects unknown data scopes instead of silently mixing datasets', async () => {
    await request(app.getHttpServer()).get('/api/v1/intelligence/overview?sourceScope=operational').expect(400);
    const manual = await request(app.getHttpServer()).get('/api/v1/intelligence/overview?sourceScope=manual').expect(200);
    expect(manual.body.sourceComposition.syntheticObservations).toBe(0);
    expect(manual.body.sourceComposition.syntheticIncidents).toBe(0);
  });
});
