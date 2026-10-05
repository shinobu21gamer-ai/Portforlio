import { test, expect } from '@playwright/test';
import { DEMO, loginApi, openCashierRegister, registerRoot } from '../helpers';

test.describe('POS sale + receipt', () => {
  test('cashier rings up a cash sale and sees a receipt', async ({ page, request }) => {
    const { token, user, refreshToken } = await loginApi(request, DEMO.cashier.email, DEMO.cashier.password);
    const catalog = await request.get('/api/v1/products?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const catalogBody = await catalog.text();
    expect(catalog.ok(), `catalog: ${catalog.status()} ${catalogBody}`).toBeTruthy();
    expect(JSON.parse(catalogBody).data.products.length).toBeGreaterThan(0);

    await openCashierRegister(page, token, user, refreshToken);

    // Same-origin iframe: wait until a product card exists in the embed (or the
    // top-level document, if the cashier shell skipped the iframe).
    await page.waitForFunction(() => {
      const inFrame = document
        .querySelector('iframe[title="Point of Sale"]')
        ?.contentDocument?.querySelector('[data-testid="product-card"]');
      const onPage = document.querySelector('[data-testid="product-card"]');
      return !!(inFrame || onPage);
    }, { timeout: 25000 });

    const iframe = page.locator('iframe[title="Point of Sale"]');
    const pos = (await iframe.count()) > 0 ? registerRoot(page) : page;
    const product = pos.getByTestId('product-card').first();
    await expect(product).toBeVisible({ timeout: 5000 });
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
