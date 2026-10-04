import { describe, it, expect, beforeEach, afterEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
// Must precede the config require below: these are CommonJS modules and
// vi.resetModules() does not clear Node's require cache.
process.env.FRONTEND_URL = 'https://shop.example.com';

// Regression cover for dead links in outbound email.
//
// FRONTEND_URL was never set on Render, and nine email templates plus the
// password-reset service each fell back to 'http://localhost:3001'. Emails were
// delivered successfully, but every link inside them pointed at the recipient's
// own machine — which looks identical to "email is broken" from the outside.
//
// These tests assert no template can emit a localhost URL again.

const helpers = require('../../src/utils/helpers');
const config = require('../../src/config');

const makeReq = (protocol: string, host: string) =>
  ({ protocol, get: (h: string) => (h === 'host' ? host : undefined) }) as any;

describe('resolvePublicOrigin', () => {
  afterEach(() => {
    delete process.env.FRONTEND_URL;
  });

  it('falls back to the request origin (the Render case)', () => {
    expect(helpers.resolvePublicOrigin(makeReq('https', 'shop.example.com'), null))
      .toBe('https://shop.example.com');
  });

  it('prefers an explicitly configured URL', () => {
    expect(helpers.resolvePublicOrigin(makeReq('https', 'ignored.example.com'), 'https://pos.example.com'))
      .toBe('https://pos.example.com');
  });

  it('strips trailing slashes so paths do not double up', () => {
    expect(helpers.resolvePublicOrigin(makeReq('https', 'x.com'), 'https://pos.example.com///'))
      .toBe('https://pos.example.com');
  });

  it('throws instead of silently returning localhost', () => {
    expect(() => helpers.resolvePublicOrigin(null, null)).toThrow(/FRONTEND_URL/);
  });

  it('config reads FRONTEND_URL when it is set', () => {
    expect(config.app.frontendUrl).toBe('https://shop.example.com');
  });
});

describe('email templates never emit localhost links', () => {
  // FRONTEND_URL must be set before src/config is first required: these modules
  // are CommonJS, and vi.resetModules() does not clear Node's require cache,
  // so a value set after the first require would never be seen by config.
  const templates = require('../../src/utils/emailTemplates');

  // Every template that renders a portal link, with the minimum args each needs.
  const cases: Array<[string, (t: any) => string]> = [
    ['payrollProcessedEmail', (t) => t.payrollProcessedEmail('J', 'Oct 2026', 40000)],
    ['leaveRequestEmail', (t) => t.leaveRequestEmail('J', 'Sick', 'pending', '2026-10-01', '2026-10-02')],
    ['contractRenewalEmail', (t) => t.contractRenewalEmail('J', 'regular', '2026-11-01', '2027-11-01', 40000)],
    ['contractExpiryEmail', (t) => t.contractExpiryEmail('J', 'regular', '2026-12-31')],
    ['employeeApprovedEmail', (t) => t.employeeApprovedEmail('J', 'EMP-0001', 'temp123', {})],
    ['contractApprovedEmail', (t) => t.contractApprovedEmail('J', 'regular', '2026-01-01', '2027-01-01', 40000)],
    ['applicationStatusEmail', (t) => t.applicationStatusEmail('J', 'Staff', 'accepted', {})],
    ['scheduleAssignmentEmail', (t) => t.scheduleAssignmentEmail('J', 'Regular', '09:00', '18:00', '2026-10-01')],
  ];

  it.each(cases)('%s renders a configured origin, never localhost', (_name, render) => {
    const html = render(templates);
    expect(html).not.toContain('localhost');
    expect(html).toContain('https://shop.example.com');
  });
});