import { expect, test } from '@playwright/test';
import { testEquipment, testEquipmentType, testOrganization, testRegion, testSummary } from '../test-helpers/inventory-fixtures';

test('returns from an equipment record to the inventory using a visible button-style link', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith('/monitoring/events/stream')) {
      await route.abort();
      return;
    }
    if (requestUrl.pathname.endsWith('/equipment-types')) {
      await route.fulfill({ json: [testEquipmentType] });
      return;
    }
    if (requestUrl.pathname.endsWith('/organizations')) {
      await route.fulfill({ json: [testOrganization] });
      return;
    }
    if (requestUrl.pathname.endsWith('/regions')) {
      await route.fulfill({ json: [testRegion] });
      return;
    }
    if (requestUrl.pathname.endsWith('/inventory/summary')) {
      await route.fulfill({ json: testSummary });
      return;
    }
    if (requestUrl.pathname.endsWith('/maintenance')) {
      await route.fulfill({ json: { items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 } });
      return;
    }
    if (requestUrl.pathname.endsWith('/equipments/equipment-1')) {
      await route.fulfill({ json: testEquipment });
      return;
    }
    if (requestUrl.pathname.endsWith('/equipments')) {
      await route.fulfill({ json: { items: [testEquipment], page: 1, pageSize: 10, total: 1, totalPages: 1 } });
      return;
    }
    await route.fulfill({ json: [] });
  });

  await page.goto('/equipments/equipment-1');

  const backLink = page.getByRole('link', { name: 'Voltar ao inventário' });
  await expect(backLink).toBeVisible();
  await expect(backLink).toHaveClass(/button/);
  await backLink.click();

  await expect(page).toHaveURL(/\/equipments$/);
  await expect(page.getByText('Inventário urbano', { exact: true })).toBeVisible();
  await expect(page.getByText('RAD-001')).toBeVisible();
});
