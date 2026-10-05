import { expect, test } from '@playwright/test';
import {
  DEMO_USERS,
  disableReceiptAutoPrint,
  embeddedPosFrame,
  getProduct,
  loginAtHrms,
  resetDemoStock,
  waitForDemoSeed,
} from '../utils';

test('cashier completes a cash sale in the embedded POS and inventory falls from 48 to 47', async ({ page, request }) => {
  const seed = await waitForDemoSeed(request);
  // Each browser project talks to the same in-memory app process. Restore the
  // published demo quantity so this scenario retains its meaningful 48 -> 47
  // assertion in both Chromium and Pixel runs.
  await resetDemoStock(request, seed.adminToken, seed.cocaCola.id, 48);

  await loginAtHrms(page, DEMO_USERS.cashier);
  await expect(page).toHaveURL(/\/hrms\/pos$/);
  const pos = await embeddedPosFrame(page);
  await disableReceiptAutoPrint(pos);

  const cocaCola = pos.locator('button.product').filter({ hasText: 'Coca-Cola 1.5L' });
  await expect(cocaCola).toBeVisible({ timeout: 30_000 });
  await expect(cocaCola).toContainText('₱52');
  await expect(cocaCola).toContainText('Stock: 48');
  await cocaCola.click();

  await pos.getByRole('button', { name: /Pay Now/ }).click();
  await pos.waitForURL(/\/payment$/);
  await pos.getByRole('button', { name: 'Cash', exact: true }).click();
  await pos.getByPlaceholder('Enter cash amount').fill('100');
  await pos.getByRole('button', { name: 'Complete Payment' }).click();

  const receipt = pos.locator('#receipt-print-area');
  await expect(receipt).toBeVisible({ timeout: 20_000 });
  await expect(receipt).toContainText('Invoice:');
  await expect(receipt).toContainText('Cash');
  await expect(receipt).toContainText('Change');

  const productAfterSale = await getProduct(request, seed.adminToken, seed.cocaCola.id);
  expect(Number(productAfterSale.stockQuantity)).toBe(47);
});
