import { expect, test } from '@playwright/test';

const demoAgent = {
  id: 'agent-1',
  name: 'Equipe demonstrativa',
  identifier: 'EQ-01',
  category: 'traffic_agent',
  organizationId: 'org-1',
  organizationName: 'Mobilidade',
  availability: 'available',
  position: null,
  operationalBase: null,
  linkedEquipment: null,
  operationalNotes: null,
  dataOrigin: 'demo',
  createdAt: '2026-10-20T12:00:00.000Z',
  updatedAt: '2026-10-24T12:00:00.000Z',
};
let createdAgentResponse: Record<string, unknown> | null = null;

test.beforeEach(async ({ page }) => {
  createdAgentResponse = null;
  await page.route('**/api/v1/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith('/monitoring/events/stream')) {
      await route.abort();
      return;
    }
    if (requestUrl.pathname.endsWith('/agents') && route.request().method() === 'GET') {
      await route.fulfill({ json: { items: [demoAgent], page: 1, pageSize: 10, total: 1, totalPages: 1 } });
      return;
    }
    if (requestUrl.pathname.endsWith('/agents') && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      createdAgentResponse = { ...demoAgent, ...body, id: 'created-agent', organizationName: 'Mobilidade', position: null, operationalBase: null, linkedEquipment: null };
      await route.fulfill({ status: 201, json: createdAgentResponse });
      return;
    }
    if (requestUrl.pathname.endsWith('/agents/operational-bases')) {
      await route.fulfill({ json: [] });
      return;
    }
    if (requestUrl.pathname.includes('/agents/')) {
      const id = requestUrl.pathname.split('/').at(-1);
      await route.fulfill({ json: id === 'created-agent' && createdAgentResponse ? createdAgentResponse : { ...demoAgent, id } });
      return;
    }
    if (requestUrl.pathname.endsWith('/organizations')) {
      await route.fulfill({ json: [{ id: 'org-1', code: 'MOB', name: 'Mobilidade' }] });
      return;
    }
    if (requestUrl.pathname.endsWith('/inventory/summary')) {
      await route.fulfill({ json: {
        totalEquipment: 0, operationalEquipment: 0, attentionEquipment: 0, immediateMaintenance: 0,
        overdueMaintenance: 0, upcomingMaintenance: 0, totalAgents: 1, availableAgents: 1,
        agentsOnDuty: 0, agentsOffDuty: 0, unavailableAgents: 0,
      } });
      return;
    }
    if (requestUrl.pathname.endsWith('/equipments')) {
      await route.fulfill({ json: { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 } });
      return;
    }
    await route.fulfill({ json: [] });
  });
});

test('opens the agent inventory and filters its results', async ({ page }) => {
  const agentRequests: URL[] = [];
  page.on('request', (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.pathname.endsWith('/api/v1/agents')) agentRequests.push(requestUrl);
  });

  await page.goto('/agents');

  await expect(page.locator('#page-title')).toHaveText('Agentes Operacionais');
  await expect(page.getByText('Equipe demonstrativa')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Base operacional' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Equipamento vinculado' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar agentes' }).fill('equipe');
  await expect.poll(() => agentRequests.some((requestUrl) => requestUrl.searchParams.get('search') === 'equipe')).toBe(true);
  await expect(page.locator('.topbar__badge')).toContainText('Sem conexão');
});

test('registers an operational agent through the existing form', async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/v1/agents', async (route) => {
    if (route.request().method() === 'POST') submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fallback();
  });
  await page.goto('/agents/new');

  await page.getByLabel('Nome completo').fill('  Agente E2E  ');
  await page.getByLabel('Matrícula ou identificação').fill(' ag-42 ');
  await page.getByLabel('Categoria profissional').selectOption('military_police_officer');
  await page.getByLabel('Órgão responsável').selectOption('org-1');
  await page.getByLabel('Disponibilidade').selectOption('on_duty');
  await page.getByRole('button', { name: 'Cadastrar agente' }).click();

  await expect(page.getByRole('heading', { name: 'Agente E2E' })).toBeVisible();
  expect(submitted).toMatchObject({
    name: 'Agente E2E', identifier: 'AG-42', category: 'military_police_officer',
    organizationId: 'org-1', availability: 'on_duty', operationalBaseId: null, equipmentId: null,
  });
});

test('changes the color theme from the application shell', async ({ page }) => {
  await page.goto('/agents');

  await page.getByRole('button', { name: 'Ativar modo claro' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Ativar modo escuro' })).toBeVisible();
});
