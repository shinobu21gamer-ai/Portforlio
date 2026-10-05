import { test, expect } from '@playwright/test';
import { DEMO, loginApi, loginUi, stubPrint } from '../helpers';

test.describe('POS sale + receipt', () => {
  test('cashier rings up a cash sale and sees a receipt', async ({ page, request }) => {
    const { token } = await loginApi(request, DEMO.cashier.email, DEMO.cashier.password);
    const catalog = await request.get('/api/v1/products?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const catalogBody = await catalog.text();
    expect(catalog.ok(), `catalog: ${catalog.status()} ${catalogBody}`).toBeTruthy();
    expect(JSON.parse(catalogBody).data.products.length).toBeGreaterThan(0);

    await stubPrint(page);
    await loginUi(page, DEMO.cashier.email, DEMO.cashier.password);
    await expect(page.getByRole('button', { name: /Back to HRMS/i })).toBeVisible({ timeout: 20000 });

    const pos = page.frameLocator('iframe[title="Point of Sale"]');
    const product = pos.getByTestId('product-card').first();
    await expect(product).toBeVisible({ timeout: 25000 });
    await page.screenshot({ path: 'docs/screenshots/pos-terminal.png', fullPage: true });
    await product.click();

    await pos.getByTestId('pay-now').click();
    await expect(pos.getByTestId('pay-method-cash')).toBeVisible({ timeout: 15000 });
    await pos.getByTestId('pay-method-cash').click();
    await pos.getByTestId('cash-exact').click();
    await pos.getByTestId('complete-payment').click();

    await expect(pos.getByTestId('receipt')).toBeVisible({ timeout: 20000 });
    await expect(pos.getByText(/Payment Success/i)).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/pos-receipt.png', fullPage: true });
  });
});
