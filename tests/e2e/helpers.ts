import { expect, Page, APIRequestContext } from '@playwright/test';

export const DEMO = {
  admin: { email: 'admin@minimart.com', password: 'admin123' },
  hr: { email: 'hr@minimart.com', password: 'hr123' },
  manager: { email: 'manager@minimart.com', password: 'admin123' },
  cashier: { email: 'cashier@minimart.com', password: 'cashier123' },
  inventory: { email: 'inventory@minimart.com', password: 'inventory123' },
  employee: { email: 'ligma1@gmail.com', password: 'employee123' },
} as const;

export async function stubPrint(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('minimart_autoprint', '0'); } catch { /* ignore */ }
    // @ts-expect-error — window.print is a function
    window.print = () => {};
  });
}

export async function loginUi(page: Page, email: string, password: string) {
  await page.goto('/hrms/login');
  await expect(page.getByTestId('login-email')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
}

export async function loginApi(request: APIRequestContext, email: string, password: string) {
  const res = await request.post('/api/v1/auth/login', { data: { email, password } });
  expect(res.ok(), `login ${email} failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const json = await res.json();
  return {
    token: json.data.token as string,
    refreshToken: json.data.refreshToken as string | undefined,
    user: json.data.user,
  };
}

function sessionPayload(token: string, user: unknown, refreshToken?: string | null) {
  return { token, userJson: JSON.stringify(user), rt: refreshToken ?? '' };
}

export async function seedPosSession(page: Page, token: string, user: unknown, refreshToken?: string | null) {
  await page.addInitScript(({ token, userJson, rt }) => {
    const parsed = JSON.parse(userJson);
    localStorage.setItem('hrms_auth', JSON.stringify({ user: parsed, token, refreshToken: rt || null }));
    localStorage.setItem('token', token);
    localStorage.setItem('user', userJson);
    if (rt) localStorage.setItem('refreshToken', rt);
    else localStorage.removeItem('refreshToken');
    localStorage.setItem('minimart_autoprint', '0');
    window.print = () => {};
  }, sessionPayload(token, user, refreshToken));
}

/** Seed HRMS+POS keys on an HTML origin, then open the cashier embed. */
export async function openCashierRegister(page: Page, token: string, user: unknown, refreshToken?: string | null) {
  const payload = sessionPayload(token, user, refreshToken);
  await seedPosSession(page, token, user, refreshToken);
  await page.goto('/');
  await page.evaluate(({ token, userJson, rt }) => {
    const parsed = JSON.parse(userJson);
    localStorage.setItem('hrms_auth', JSON.stringify({ user: parsed, token, refreshToken: rt || null }));
    localStorage.setItem('token', token);
    localStorage.setItem('user', userJson);
    if (rt) localStorage.setItem('refreshToken', rt);
    localStorage.setItem('minimart_autoprint', '0');
  }, payload);
  await page.goto('/hrms/pos');
}

export function registerRoot(page: Page) {
  return page.frameLocator('iframe[title="Point of Sale"]');
}
