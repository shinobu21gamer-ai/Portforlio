import { expect, type APIRequestContext, type Frame, type Page } from '@playwright/test';

/**
 * Real, development-only accounts inserted by seedDemoData() in src/server.js.
 * Keeping them here lets the UI tests exercise the same authentication path a
 * developer uses rather than injecting a token or creating test-only accounts.
 */
export const DEMO_USERS = {
  admin: {
    label: 'admin', email: 'admin@minimart.com', password: 'admin123', role: 'admin',
  },
  hr: {
    label: 'hr', email: 'hr@minimart.com', password: 'hr123', role: 'hr',
  },
  manager: {
    label: 'manager', email: 'manager@minimart.com', password: 'admin123', role: 'manager',
  },
  cashier: {
    label: 'cashier', email: 'cashier@minimart.com', password: 'cashier123', role: 'cashier',
  },
  inventory: {
    label: 'inventory staff', email: 'inventory@minimart.com', password: 'inventory123', role: 'inventory_staff',
  },
  employee: {
    label: 'employee', email: 'ligma1@gmail.com', password: 'employee123', role: 'employee',
  },
} as const;

export type DemoUser = (typeof DEMO_USERS)[keyof typeof DEMO_USERS];

export type Product = {
  id: number;
  name: string;
  slug: string;
  sellingPrice: number | string;
  stockQuantity: number | string;
};

export type DemoSeed = {
  adminToken: string;
  cocaCola: Product;
};

const API = '/api/v1';
const SEED_TIMEOUT_MS = 90_000;
const SEED_POLL_MS = 500;

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

const responseText = async (response: { text(): Promise<string> }) => {
  try { return await response.text(); } catch { return '(response body unavailable)'; }
};

/** Sign in over the public API, returning a real short-lived access token. */
export async function apiLogin(request: APIRequestContext, user: Pick<DemoUser, 'email' | 'password'>): Promise<string> {
  const response = await request.post(`${API}/auth/login`, {
    data: { email: user.email, password: user.password },
  });
  if (!response.ok()) {
    throw new Error(`API login for ${user.email} returned ${response.status()}: ${await responseText(response)}`);
  }
  const payload = await response.json();
  const token = payload?.data?.token;
  if (!token) throw new Error(`API login for ${user.email} succeeded without data.token`);
  return token;
}

const productsFrom = (payload: any): Product[] => {
  const candidates = [
    payload?.data?.products,
    payload?.products,
    payload?.data?.data?.products,
  ];
  return candidates.find(Array.isArray) || [];
};

/**
 * AUTO_SETUP seeds in the background after the HTTP listener starts. A bare
 * /health check therefore races the seed routinely. Poll the two meaningful
 * readiness signals instead: the seeded admin must authenticate and the POS
 * catalogue must contain the seeded Coca-Cola product.
 */
export async function waitForDemoSeed(request: APIRequestContext): Promise<DemoSeed> {
  const deadline = Date.now() + SEED_TIMEOUT_MS;
  let lastProblem = 'seed has not started yet';

  while (Date.now() < deadline) {
    try {
      const adminToken = await apiLogin(request, DEMO_USERS.admin);
      const response = await request.get(`${API}/products?search=Coca-Cola%201.5L&limit=50`, {
        headers: bearer(adminToken),
      });
      if (!response.ok()) {
        lastProblem = `GET /products returned ${response.status()}: ${await responseText(response)}`;
      } else {
        const products = productsFrom(await response.json());
        const cocaCola = products.find((product) => product.slug === 'coca-cola-15l');
        if (cocaCola) return { adminToken, cocaCola };
        lastProblem = `catalogue returned ${products.length} products but Coca-Cola 1.5L is not seeded yet`;
      }
    } catch (error: any) {
      lastProblem = error?.message || String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, SEED_POLL_MS));
  }

  throw new Error(`Demo seed was not ready after ${SEED_TIMEOUT_MS / 1000}s: ${lastProblem}`);
}

/** Perform the normal HRMS login form flow; never use POS /login (a redirect stub). */
export async function loginAtHrms(page: Page, user: Pick<DemoUser, 'email' | 'password'>): Promise<void> {
  await page.goto('/hrms/login');
  await expect(page).toHaveURL(/\/hrms\/login$/);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).not.toHaveURL(/\/hrms\/login$/, { timeout: 20_000 });
}

/** Return the actual embedded POS Frame after its cross-app SSO handshake. */
export async function embeddedPosFrame(page: Page): Promise<Frame> {
  const iframe = page.locator('iframe[title="Point of Sale"]');
  await expect(iframe).toBeVisible({ timeout: 20_000 });
  const handle = await iframe.elementHandle();
  const frame = await handle?.contentFrame();
  if (!frame) throw new Error('Point of Sale iframe did not expose a content frame');
  await frame.waitForLoadState('domcontentloaded');
  // Seeing the POS search field proves the postMessage token handoff has
  // finished and ProtectedRoute has rendered /pos. In particular, the override
  // spec must not navigate the frame to /payment/success while its initial SSO
  // authentication is still in flight (that would discard the token handoff).
  await frame.locator('input[aria-label="Scan barcode or search products"]').waitFor({
    state: 'visible', timeout: 20_000,
  });
  return frame;
}

/** Avoid a native print dialog while asserting the receipt UI in headless CI. */
export async function disableReceiptAutoPrint(frame: Frame): Promise<void> {
  await frame.evaluate(() => localStorage.setItem('minimart_autoprint', '0'));
}

/**
 * Restore the known demo stock before either transaction scenario. Both desktop
 * and Pixel projects run the same e2e suite against one sqlite process, so this
 * makes the required 48 -> 47 assertion deterministic in each project.
 */
export async function resetDemoStock(
  request: APIRequestContext,
  adminToken: string,
  productId: number,
  quantity = 48,
): Promise<void> {
  const response = await request.post(`${API}/inventory/adjust`, {
    headers: bearer(adminToken),
    data: {
      productId,
      newQuantity: quantity,
      reason: 'Playwright demo-stock reset',
    },
  });
  expect(response.status(), await responseText(response)).toBe(200);
}

export async function getProduct(request: APIRequestContext, token: string, productId: number): Promise<Product> {
  const response = await request.get(`${API}/products/${productId}`, { headers: bearer(token) });
  if (response.status() !== 200) {
    throw new Error(`GET /products/${productId} returned ${response.status()}: ${await responseText(response)}`);
  }
  const payload = await response.json();
  return payload.data;
}

export async function getSale(request: APIRequestContext, token: string, saleId: number) {
  const response = await request.get(`${API}/sales/${saleId}`, { headers: bearer(token) });
  if (response.status() !== 200) {
    throw new Error(`GET /sales/${saleId} returned ${response.status()}: ${await responseText(response)}`);
  }
  const payload = await response.json();
  return payload.data;
}

/** Log out through the actual HRMS topbar control. */
export async function logoutFromTopbar(page: Page): Promise<void> {
  const logout = page.locator('button.topbar__logout');
  await expect(logout).toBeVisible({ timeout: 15_000 });
  await logout.click();
  await expect(page).toHaveURL(/\/hrms\/login$/, { timeout: 15_000 });
}
