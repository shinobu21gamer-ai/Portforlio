import { describe, it, expect } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

// Regression cover for the PayMongo redirect origin.
//
// POS_FRONTEND_URL was unset in every deploy config, so posFrontendUrl fell back
// to 'http://localhost:5173' and every checkout session was created with a
// localhost success_url. PayMongo rejects non-HTTPS URLs in live mode, so
// create-checkout 400'd before any charge; on test mode it redirected the
// customer to their own machine instead.
//
// The fix derives the origin from the request, so these tests pin the two
// behaviours that matter: never localhost by default, and honour an explicit
// override when one is set.

const paymentRoutes = require('../../src/routes/payment');
const { resolvePublicOrigin } = paymentRoutes;

// Minimal stand-in for the bits of an Express request the helper reads.
const makeReq = (protocol: string, host: string) =>
  ({ protocol, get: (h: string) => (h === 'host' ? host : undefined) }) as any;

describe('payment routes - resolvePublicOrigin', () => {
  it('falls back to the request origin when nothing is configured', () => {
    expect(resolvePublicOrigin(makeReq('https', 'shop.example.com'), null))
      .toBe('https://shop.example.com');
  });

  it('uses the https origin behind a proxy (Render)', () => {
    // Regression guard: this is the deployed shape. A localhost default here
    // produced success_url=http://localhost:5173/... in production.
    const origin = resolvePublicOrigin(
      makeReq('https', 'portforlio-1cqq.onrender.com'),
      null
    );

    expect(origin).toBe('https://portforlio-1cqq.onrender.com');
    expect(origin.startsWith('http://localhost')).toBe(false);
  });

  it('never returns a localhost default when unconfigured', () => {
    const origin = resolvePublicOrigin(makeReq('https', 'anything.example.com'), null);
    expect(origin).not.toContain('localhost');
  });

  it('honours an explicit POS_FRONTEND_URL override', () => {
    expect(resolvePublicOrigin(makeReq('https', 'ignored.example.com'), 'https://pos.example.com'))
      .toBe('https://pos.example.com');
  });

  it('strips a trailing slash so paths do not double up', () => {
    expect(resolvePublicOrigin(makeReq('https', 'x.example.com'), 'https://pos.example.com/'))
      .toBe('https://pos.example.com');
    expect(resolvePublicOrigin(makeReq('https', 'x.example.com'), 'https://pos.example.com///'))
      .toBe('https://pos.example.com');
  });

  it('builds a usable success URL', () => {
    const origin = resolvePublicOrigin(makeReq('https', 'shop.example.com'), null);
    const successUrl = `${origin}/payment/success?saleId=7&session_id=cs_test`;

    expect(successUrl).toBe('https://shop.example.com/payment/success?saleId=7&session_id=cs_test');
    expect(successUrl).not.toContain('//payment');
  });
});

describe('payment routes - configured posFrontendUrl default', () => {
  it('is null when POS_FRONTEND_URL is unset, so callers can fall back', () => {
    // If this regressed to a localhost string, every deployment would silently
    // build localhost PayMongo redirects again.
    delete process.env.POS_FRONTEND_URL;
    vi.resetModules();
    const config = require('../../src/config');
    expect(config.app.posFrontendUrl).toBeNull();
  });
});