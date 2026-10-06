import { test, expect } from '@playwright/test';
import fs from 'fs';
import { DEMO, loginApi } from '../helpers';

test.describe('POS sale + receipt', () => {
  test('cashier rings up a cash sale and sees a receipt', async ({ page, request }) => {
    const { token, user, refreshToken } = await loginApi(request, DEMO.cashier.email, DEMO.cashier.password);
    const catalog = await request.get('/api/v1/products?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const catalogBody = await catalog.text();
    expect(catalog.ok(), `catalog: ${catalog.status()} ${catalogBody}`).toBeTruthy();
    const product = JSON.parse(catalogBody).data.products[0];
    expect(product?.id).toBeTruthy();

    // Backend cash sale — independent of the SPA.
    const saleRes = await request.post('/api/v1/sales', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        items: [{ productId: product.id, quantity: 1 }],
        paymentMethod: 'cash',
        cashAmount: 100000,
      },
    });
    expect(saleRes.status(), await saleRes.text()).toBe(201);

    const payload = {
      token,
      userJson: JSON.stringify(user),
      rt: refreshToken ?? '',
      cartJson: JSON.stringify([{
        id: product.id,
        name: product.name,
        sku: product.sku,
        sellingPrice: parseFloat(product.sellingPrice) || 1,
        price: parseFloat(product.sellingPrice) || 1,
        quantity: 1,
        stockQuantity: Math.max(1, parseInt(product.stockQuantity, 10) || 1),
        taxRate: product.taxRate,
      }]),
    };

    await page.addInitScript(({ token, userJson, rt, cartJson }) => {
      const parsed = JSON.parse(userJson);
      localStorage.setItem('hrms_auth', JSON.stringify({ user: parsed, token, refreshToken: rt || null }));
      localStorage.setItem('token', token);
      localStorage.setItem('user', userJson);
      if (rt) localStorage.setItem('refreshToken', rt);
      else localStorage.removeItem('refreshToken');
      localStorage.setItem('minimart_cart', cartJson);
      localStorage.setItem('minimart_autoprint', '0');
      window.print = () => {};
    }, payload);

    await page.goto('/');
    await page.evaluate(({ token, userJson, rt, cartJson }) => {
      const parsed = JSON.parse(userJson);
      localStorage.setItem('hrms_auth', JSON.stringify({ user: parsed, token, refreshToken: rt || null }));
      localStorage.setItem('token', token);
      localStorage.setItem('user', userJson);
      if (rt) localStorage.setItem('refreshToken', rt);
      localStorage.setItem('minimart_cart', cartJson);
      localStorage.setItem('minimart_autoprint', '0');
    }, payload);

    await page.goto('/payment');
    const cashBtn = page.getByTestId('pay-method-cash');
    try {
      await expect(cashBtn).toBeVisible({ timeout: 20000 });
    } catch (err) {
      throw new Error(`payment UI missing. url=${page.url()}\n${(await page.content()).slice(0, 2000)}`);
    }
    await page.screenshot({ path: 'docs/screenshots/pos-terminal.png', fullPage: true });
    await cashBtn.click();
    await page.getByTestId('cash-exact').click();
    await page.getByTestId('complete-payment').click();

    const receipt = page.getByTestId('receipt');
    await expect(receipt).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Payment Success/i)).toBeVisible();

    // A receipt with nothing on it is worse than no receipt: the cashier hands
    // the customer a blank slip. Assert the actual content survives the round
    // trip from POST /sales to the success screen.
    await expect(page.getByTestId('receipt-invoice')).toContainText(/INV-/i);
    await expect(page.getByTestId('receipt-items')).toContainText(product.name);
    await expect(page.getByTestId('receipt-items')).not.toContainText(/No items/i);
    await expect(page.getByTestId('receipt-total')).toContainText('₱');
    await expect(page.getByTestId('receipt-payment')).toContainText(/Cash/i);
    await expect(receipt).toContainText('This receipt serves as your official proof of purchase.');
    await page.screenshot({ path: 'docs/screenshots/pos-receipt.png', fullPage: true });

    // The print/download document is what actually reaches the thermal printer.
    // It must be a complete 80mm slip, not an empty shell.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download HTML/i }).click(),
    ]);
    const savedPath = await download.path();
    expect(savedPath, 'download produced no file').toBeTruthy();
    const savedHtml = fs.readFileSync(savedPath as string, 'utf8');
    expect(savedHtml).toContain('@page { size: 80mm auto; margin: 0; }');
    expect(savedHtml).toContain(product.name);
    expect(savedHtml).toMatch(/INV-/i);
    expect(savedHtml).toContain('₱');
    expect(savedHtml).not.toContain('No items recorded');

    // Printing must not break the success screen (window.print is stubbed above,
    // including in the hidden print frame created for the slip).
    await page.getByTestId('print-receipt').click();
    await page.waitForTimeout(800);
    await expect(page.getByTestId('receipt')).toBeVisible();
    await expect(page.getByTestId('receipt-total')).toContainText('₱');
  });
});
