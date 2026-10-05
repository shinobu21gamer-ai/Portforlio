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
    await page.goto('/health');
    await page.evaluate(({ token, user, refreshToken }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('minimart_autoprint', '0');
    }, { token: admin.token, user: admin.user, refreshToken: admin.refreshToken ?? null });
    await page.goto(`/payment/success?saleId=${saleId}`);

    await expect(page.getByText(/Waiting for payment confirmation/i)).toBeVisible({ timeout: 20000 });
    await page.getByTestId('cash-override').click();
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Payment Success/i)).toBeVisible();
  });
});
