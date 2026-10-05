import { test, expect } from '@playwright/test';
import { DEMO, loginApi, seedPosSession } from '../helpers';

test.describe('POS sale + receipt', () => {
  test('cashier rings up a cash sale and sees a receipt', async ({ page, request }) => {
    const { token, user, refreshToken } = await loginApi(request, DEMO.cashier.email, DEMO.cashier.password);
    const catalog = await request.get('/api/v1/products?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const catalogBody = await catalog.text();
    expect(catalog.ok(), `catalog: ${catalog.status()} ${catalogBody}`).toBeTruthy();
    expect(JSON.parse(catalogBody).data.products.length).toBeGreaterThan(0);

    await seedPosSession(page, token, user, refreshToken);
    await page.goto('/pos');
    await expect(page).toHaveURL(/\/pos/);
    await expect(page.getByRole('heading', { name: /MiniMart POS/i })).toBeVisible({ timeout: 20000 });

    const product = page.getByTestId('product-card').first();
    await expect(product).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: 'docs/screenshots/pos-terminal.png', fullPage: true });
    await product.click();

    await page.getByTestId('pay-now').click();
    await expect(page.getByTestId('pay-method-cash')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('pay-method-cash').click();
    await page.getByTestId('cash-exact').click();
    await page.getByTestId('complete-payment').click();

    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Payment Success/i)).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/pos-receipt.png', fullPage: true });
  });
});
