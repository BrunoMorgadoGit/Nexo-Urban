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
  dataOrigin: 'demo',
  createdAt: '2026-10-20T12:00:00.000Z',
  updatedAt: '2026-10-24T12:00:00.000Z',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith('/monitoring/events/stream')) {
      await route.abort();
      return;
    }
    if (requestUrl.pathname.endsWith('/agents')) {
      await route.fulfill({ json: { items: [demoAgent], page: 1, pageSize: 10, total: 1, totalPages: 1 } });
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
      } });
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

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agentes');
  await expect(page.getByText('Equipe demonstrativa')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar agentes' }).fill('equipe');
  await expect.poll(() => agentRequests.some((requestUrl) => requestUrl.searchParams.get('search') === 'equipe')).toBe(true);
  await expect(page.locator('.topbar__badge')).toContainText('Sem conexão');
});

test('changes the color theme from the application shell', async ({ page }) => {
  await page.goto('/agents');

  await page.getByRole('button', { name: 'Ativar modo claro' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Ativar modo escuro' })).toBeVisible();
});
