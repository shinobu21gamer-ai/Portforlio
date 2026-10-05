import { test, expect } from '@playwright/test';
import { DEMO, loginUi, stubPrint } from '../helpers';

test.describe('role login → main job → logout', () => {
  test.beforeEach(async ({ page }) => {
    await stubPrint(page);
  });

  test('admin lands on the HRMS dashboard and can sign out', async ({ page }) => {
    await loginUi(page, DEMO.admin.email, DEMO.admin.password);
    await expect(page.getByTestId('logout-button')).toBeVisible({ timeout: 20000 });
    await expect(page).toHaveURL(/\/hrms\/?$/);
    await page.screenshot({ path: 'docs/screenshots/hrms-dashboard.png', fullPage: true });
    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/hrms\/login/);
  });

  test('HR lands on the HRMS dashboard and can sign out', async ({ page }) => {
    await loginUi(page, DEMO.hr.email, DEMO.hr.password);
    await expect(page.getByTestId('logout-button')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/hrms\/login/);
  });

  test('employee lands on My Profile and can sign out', async ({ page }) => {
    await loginUi(page, DEMO.employee.email, DEMO.employee.password);
    await expect(page.getByTestId('logout-button')).toBeVisible({ timeout: 20000 });
    await expect(page).toHaveURL(/my-profile/);
    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/hrms\/login/);
  });

  test('cashier is sent to POS, can return to HRMS, then sign out', async ({ page }) => {
    await loginUi(page, DEMO.cashier.email, DEMO.cashier.password);
    await expect(page.getByRole('button', { name: /Back to HRMS/i })).toBeVisible({ timeout: 20000 });
    await expect(page).toHaveURL(/\/pos/);
    await page.getByRole('button', { name: /Back to HRMS/i }).click();
    await expect(page.getByTestId('logout-button')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/hrms\/login/);
  });

  test('manager is sent to POS', async ({ page }) => {
    await loginUi(page, DEMO.manager.email, DEMO.manager.password);
    await expect(page.getByRole('button', { name: /Back to HRMS/i })).toBeVisible({ timeout: 20000 });
    await expect(page).toHaveURL(/\/pos/);
  });

  test('inventory staff is sent to POS', async ({ page }) => {
    await loginUi(page, DEMO.inventory.email, DEMO.inventory.password);
    await expect(page.getByRole('button', { name: /Back to HRMS/i })).toBeVisible({ timeout: 20000 });
    await expect(page).toHaveURL(/\/pos/);
  });
});
