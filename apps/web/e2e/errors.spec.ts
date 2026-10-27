import { expect, test } from '@playwright/test';

test('shows a not-found page for unknown routes and returns to operations', async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.goto('/rota-inexistente');

  await expect(page).toHaveURL(/\/not-found$/);
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Não encontramos esta página' })).toBeVisible();
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth, `A página 404 não deve transbordar em ${width}px.`).toBeLessThanOrEqual(width);
  }
  await page.getByRole('link', { name: 'Voltar à Central de Operações' }).click();

  await expect(page).toHaveURL(/\/command$/);
  await expect(page.getByRole('heading', { name: 'Central de Operações' })).toBeVisible();
});

test('shows a tailored service error and retries the failed request', async ({ page }) => {
  let agentRequests = 0;
  await page.route('**/api/v1/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith('/monitoring/events/stream')) {
      await route.abort();
      return;
    }
    if (requestUrl.pathname.endsWith('/agents') && route.request().method() === 'GET') {
      agentRequests += 1;
      await route.fulfill({
        status: 503,
        json: { statusCode: 503, message: 'O cadastro de agentes está temporariamente indisponível.' },
      });
      return;
    }
    if (requestUrl.pathname.endsWith('/organizations')) {
      await route.fulfill({ json: [] });
      return;
    }
    if (requestUrl.pathname.endsWith('/inventory/summary')) {
      await route.fulfill({ json: {
        totalEquipment: 0, operationalEquipment: 0, attentionEquipment: 0, immediateMaintenance: 0,
        overdueMaintenance: 0, upcomingMaintenance: 0, totalAgents: 0, availableAgents: 0,
        agentsOnDuty: 0, agentsOffDuty: 0, unavailableAgents: 0,
      } });
      return;
    }
    await route.abort();
  });

  await page.goto('/agents');

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Não foi possível carregar os agentes');
  await expect(alert).toContainText('O cadastro de agentes está temporariamente indisponível.');
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth, `O erro da API não deve transbordar em ${width}px.`).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect.poll(() => agentRequests).toBe(2);
  await expect(alert).toContainText('O cadastro de agentes está temporariamente indisponível.');
});
