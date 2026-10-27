import { expect, test } from '@playwright/test';

const overview = {
  demoMode: false,
  totalEquipment: 12,
  equipmentStatusCounts: {
    not_installed: 1,
    operational: 5,
    malfunctioning: 2,
    maintenance: 2,
    deactivated: 1,
    stolen: 1,
  },
  unclassifiedEquipment: 0,
  eligibleEquipment: 10,
  operationalEquipment: 5,
  unavailableEquipment: 5,
  availabilityPercent: 50,
  agentsOnDuty: 3,
  activeCriticalAlerts: 0,
  overdueMaintenance: 1,
  calculatedAt: '2026-10-27T12:00:00.000Z',
};

const validation = {
  sourceScope: 'demo',
  evaluatedAt: '2026-10-27T12:00:00.000Z',
  methodVersion: 'risk-rules-v1',
  horizonHours: 24,
  evaluationStart: '2026-08-01T00:00:00.000Z',
  evaluationEnd: '2026-10-27T00:00:00.000Z',
  sampleWindows: 0,
  incidentWindows: 0,
  excludedInsufficientWindows: 0,
  incidentPrevalence: null,
  modelThreshold: 50,
  baselineRule: 'Histórico recente',
  modelPrecision: null,
  modelRecall: null,
  baselinePrecision: null,
  baselineRecall: null,
  modelConfusion: { truePositives: 0, falsePositives: 0, trueNegatives: 0, falseNegatives: 0 },
  baselineConfusion: { truePositives: 0, falsePositives: 0, trueNegatives: 0, falseNegatives: 0 },
  modelClassificationDistribution: { low: 0, moderate: 0, elevated: 0, critical: 0 },
  modelPredictionRate: null,
  baselinePredictionRate: null,
  precisionAtOne: { evaluatedCutoffs: 0, truePositives: 0, precision: null, recall: null },
  evaluationQuality: 'insufficient_sample',
  periods: [],
  limitations: ['A amostra é insuficiente para comparação.'],
};

test('keeps the equipment distribution panel sized to its chart and lists inventory maintenance', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/api/v1/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith('/monitoring/events/stream')) {
      await route.abort();
      return;
    }
    if (requestUrl.pathname.endsWith('/monitoring/overview')) {
      await route.fulfill({ json: overview });
      return;
    }
    if (requestUrl.pathname.endsWith('/monitoring/maintenance-alerts')) {
      await route.fulfill({ json: [{
        source: 'inventory_schedule',
        maintenanceId: null,
        equipmentId: 'equipment-schedule',
        serialNumber: 'RAD-E2E-01',
        typeLabel: 'Radar de velocidade',
        scheduledDate: '2026-10-26',
        description: 'Próxima manutenção registrada no inventário.',
        priority: 'normal',
        status: null,
        urgency: 'overdue',
      }] });
      return;
    }
    if (requestUrl.pathname.endsWith('/monitoring/alerts')) {
      await route.fulfill({ json: { items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 } });
      return;
    }
    if (requestUrl.pathname.endsWith('/monitoring/regions')) {
      await route.fulfill({ json: [] });
      return;
    }
    if (requestUrl.pathname.endsWith('/monitoring/map')) {
      await route.fulfill({ json: { demoMode: false, items: [], withoutPosition: 0, generatedAt: overview.calculatedAt } });
      return;
    }
    await route.fulfill({ json: [] });
  });

  await page.goto('/command');

  await expect(page.getByRole('heading', { name: 'Situação dos equipamentos' })).toBeVisible();
  await expect(page.getByText('RAD-E2E-01')).toBeVisible();
  await expect(page.getByText('Agenda do inventário')).toBeVisible();
  const panel = page.getByRole('region', { name: 'Situação dos equipamentos' });
  await expect(panel.locator('.distribution-chart')).toBeVisible();
  const panelBox = await panel.boundingBox();
  const noteBox = await panel.locator('.availability-note').boundingBox();
  const chartBox = await panel.locator('.donut-wrap').boundingBox();
  expect(panelBox).not.toBeNull();
  expect(noteBox).not.toBeNull();
  expect(chartBox).not.toBeNull();
  expect(chartBox!.width).toBeGreaterThan(140);
  expect(chartBox!.width).toBeLessThan(220);
  expect(panelBox!.y + panelBox!.height - noteBox!.y - noteBox!.height).toBeLessThan(100);
});

test('shows operational history separately when the predictive analysis scope changes', async ({ page }) => {
  let requestedManualScope = false;
  await page.route('**/api/v1/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith('/intelligence/overview')) {
      const sourceScope = requestUrl.searchParams.get('sourceScope') ?? 'demo';
      requestedManualScope ||= sourceScope === 'manual';
      await route.fulfill({ json: {
        sourceScope,
        evaluatedAt: '2026-10-27T12:00:00.000Z',
        referenceAt: '2026-10-27T12:00:00.000Z',
        windowStart: '2026-07-29T12:00:00.000Z',
        horizonHours: 24,
        historyWindowDays: 90,
        methodVersion: 'risk-rules-v1',
        dataQuality: 'insufficient',
        sourceComposition: sourceScope === 'manual'
          ? { syntheticObservations: 0, syntheticIncidents: 0, manualObservations: 3, manualIncidents: 2 }
          : { syntheticObservations: 90, syntheticIncidents: 12, manualObservations: 0, manualIncidents: 0 },
        regionCount: 0,
        insufficientRegionCount: 0,
        highestRiskRegions: [],
        maintenancePriorities: [],
        trendSummary: [],
      } });
      return;
    }
    if (requestUrl.pathname.endsWith('/intelligence/validation')) {
      await route.fulfill({ json: { ...validation, sourceScope: requestUrl.searchParams.get('sourceScope') ?? 'demo' } });
      return;
    }
    if (requestUrl.pathname.endsWith('/intelligence/regions')) {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fulfill({ json: [] });
  });

  await page.goto('/intelligence');
  await expect(page.getByText('90 observações sintéticas')).toBeVisible();
  await page.getByLabel('Origem dos dados').selectOption('manual');

  await expect.poll(() => requestedManualScope).toBe(true);
  await expect(page.getByText('3 observações operacionais')).toBeVisible();
  await expect(page.getByText('2 incidentes operacionais')).toBeVisible();
  await expect(page.getByText('0 observações sintéticas')).toBeVisible();
});
