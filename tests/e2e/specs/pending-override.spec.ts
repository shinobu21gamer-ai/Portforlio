import { test, expect } from '@playwright/test';
import { DEMO, loginApi, seedPosSession } from '../helpers';

test.describe('online-pay pending → cash override', () => {
  test('admin completes a pending online sale as cash and sees the receipt', async ({ page, request }) => {
    const cashier = await loginApi(request, DEMO.cashier.email, DEMO.cashier.password);
    const products = await request.get('/api/v1/products?limit=1', {
      headers: { Authorization: `Bearer ${cashier.token}` },
    });
    expect(products.ok()).toBeTruthy();
    const productList = (await products.json()).data.products;
    expect(productList.length).toBeGreaterThan(0);
    const productId = productList[0].id;

    const pending = await request.post('/api/v1/sales/pending', {
      headers: { Authorization: `Bearer ${cashier.token}` },
      data: { items: [{ productId, quantity: 1 }], paymentMethod: 'gcash' },
    });
    expect(pending.status(), await pending.text()).toBe(201);
    const saleId = (await pending.json()).data.id;

    const admin = await loginApi(request, DEMO.admin.email, DEMO.admin.password);
    await seedPosSession(page, admin.token, admin.user, admin.refreshToken);
    page.on('dialog', (d) => d.accept());
    await page.goto('/');
    await page.evaluate(({ token, userJson, rt }) => {
      const user = JSON.parse(userJson);
      localStorage.setItem('hrms_auth', JSON.stringify({ user, token, refreshToken: rt || null }));
      localStorage.setItem('token', token);
      localStorage.setItem('user', userJson);
      if (rt) localStorage.setItem('refreshToken', rt);
      localStorage.setItem('minimart_autoprint', '0');
    }, { token: admin.token, userJson: JSON.stringify(admin.user), rt: admin.refreshToken ?? '' });
    await page.goto(`/payment/success?saleId=${saleId}`);

    await expect(page.getByText(/Waiting for payment confirmation/i)).toBeVisible({ timeout: 20000 });
    await page.getByTestId('cash-override').click();
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Payment Success/i)).toBeVisible();
    // The overridden sale still has to produce a receipt with something on it.
    await expect(page.getByTestId('receipt-invoice')).toContainText(/INV-/i);
    await expect(page.getByTestId('receipt-items')).not.toContainText(/No items/i);
    await expect(page.getByTestId('receipt-total')).toContainText('₱');
  });
});
