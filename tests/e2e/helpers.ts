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

function persistPosSession(session: { token: string; user: unknown; refreshToken: string | null }) {
  localStorage.setItem('token', session.token);
  localStorage.setItem('user', JSON.stringify(session.user));
  if (session.refreshToken) localStorage.setItem('refreshToken', session.refreshToken);
  else localStorage.removeItem('refreshToken');
  localStorage.setItem('minimart_autoprint', '0');
  // @ts-expect-error — window.print is a function
  window.print = () => {};
}

/** Persist a POS session without the SSO query-param (which strips other search params). */
export async function seedPosSession(page: Page, token: string, user: unknown, refreshToken?: string | null) {
  await page.addInitScript(persistPosSession, { token, user, refreshToken: refreshToken ?? null });
}

/** Same-origin write + navigation so Zustand reads the token on module init. */
export async function gotoPos(page: Page, token: string, user: unknown, refreshToken?: string | null) {
  const payload = { token, user, refreshToken: refreshToken ?? null };
  await page.addInitScript(persistPosSession, payload);
  // /health is JSON on the API origin — establishes localStorage without racing the SPA.
  await page.goto('/health');
  await page.evaluate(persistPosSession, payload);
  await page.goto('/pos');
}
