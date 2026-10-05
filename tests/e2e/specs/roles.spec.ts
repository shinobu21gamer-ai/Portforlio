import { expect, test } from '@playwright/test';
import {
  DEMO_USERS, embeddedPosFrame, loginAtHrms, logoutFromTopbar, waitForDemoSeed,
} from '../utils';

/**
 * These are deliberately six individual tests (rather than one loop assertion)
 * so every demo role is visible in CI output. Across chromium + mobile-chrome
 * they make twelve of the sixteen collected e2e tests.
 */
const cases = [
  { user: DEMO_USERS.admin, landing: 'dashboard' as const, logoutRoute: null },
  { user: DEMO_USERS.hr, landing: 'dashboard' as const, logoutRoute: null },
  { user: DEMO_USERS.manager, landing: 'pos' as const, logoutRoute: '/hrms/employees' },
  { user: DEMO_USERS.cashier, landing: 'pos' as const, logoutRoute: '/hrms/my-profile' },
  { user: DEMO_USERS.inventory, landing: 'pos' as const, logoutRoute: '/hrms/my-profile' },
  { user: DEMO_USERS.employee, landing: 'profile' as const, logoutRoute: null },
];

for (const scenario of cases) {
  test(`${scenario.user.label} demo account signs in at HRMS, reaches its role landing page, and signs out`, async ({ page, request }) => {
    // AUTO_SETUP intentionally does not block server startup. Wait for the
    // seeded admin + non-empty products API before interacting with a form so
    // this suite tests a real demo environment rather than a startup race.
    await waitForDemoSeed(request);
    await loginAtHrms(page, scenario.user);

    if (scenario.landing === 'pos') {
      await expect(page).toHaveURL(/\/hrms\/pos$/);
      await embeddedPosFrame(page);

      // PosEmbed is a full-screen iframe overlay, so it intentionally covers
      // the underlying topbar. Move to an allowed HRMS page before clicking the
      // real topbar logout control; the landing assertion above still verifies
      // that POS roles were routed to /hrms/pos first.
      await page.goto(scenario.logoutRoute!);
      await expect(page).toHaveURL(new RegExp(`${scenario.logoutRoute}$`));
    } else if (scenario.landing === 'profile') {
      await expect(page).toHaveURL(/\/hrms\/my-profile$/);
    } else {
      await expect(page).toHaveURL(/\/hrms\/?$/);
      await expect(page.getByRole('main')).toBeVisible();
    }

    await logoutFromTopbar(page);
  });
}
