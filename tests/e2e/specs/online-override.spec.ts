import { expect, test } from '@playwright/test';
import {
  DEMO_USERS,
  apiLogin,
  bearer,
  disableReceiptAutoPrint,
  embeddedPosFrame,
  getSale,
  loginAtHrms,
  resetDemoStock,
  waitForDemoSeed,
} from '../utils';

test('manager records an abandoned GCash checkout as a completed cash sale from the POS override', async ({ page, request }) => {
  const seed = await waitForDemoSeed(request);
  await resetDemoStock(request, seed.adminToken, seed.cocaCola.id, 48);
  const managerToken = await apiLogin(request, DEMO_USERS.manager);

  // PayMongo cannot run in CI. A pending GCash sale is the exact server state
  // left by an abandoned online checkout, so create it through the real API and
  // exercise the manager/admin cash escape hatch in the UI.
  const pendingResponse = await request.post('/api/v1/sales/pending', {
    headers: bearer(managerToken),
    data: {
      items: [{ productId: seed.cocaCola.id, quantity: 1 }],
      paymentMethod: 'gcash',
      shippingFee: 0,
    },
  });
  if (pendingResponse.status() !== 201) {
    throw new Error(`POST /sales/pending returned ${pendingResponse.status()}: ${await pendingResponse.text()}`);
  }
  const pending = (await pendingResponse.json()).data;
  expect(pending.status).toBe('pending');
  expect(pending.paymentMethod).toBe('gcash');

  await loginAtHrms(page, DEMO_USERS.manager);
  await expect(page).toHaveURL(/\/hrms\/pos$/);
  const pos = await embeddedPosFrame(page);
  await disableReceiptAutoPrint(pos);

  // Navigate the embedded POS frame itself; this preserves its SSO session and
  // hits the same payment-success view PayMongo would return to after checkout.
  await pos.goto(`/payment/success?saleId=${pending.id}`);
  const override = pos.getByRole('button', { name: 'Record cash & complete sale' });
  await expect(override).toBeVisible({ timeout: 20_000 });

  page.once('dialog', (dialog) => dialog.accept());
  await override.click();

  const receipt = pos.locator('#receipt-print-area');
  await expect(receipt).toBeVisible({ timeout: 20_000 });
  await expect(receipt).toContainText('Cash');

  const completed = await getSale(request, managerToken, pending.id);
  expect(completed.status).toBe('completed');
  expect(completed.paymentStatus).toBe('paid');
  expect(completed.paymentMethod).toBe('cash');
});
