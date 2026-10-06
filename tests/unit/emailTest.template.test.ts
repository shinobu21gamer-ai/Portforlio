/**
 * The diagnostic "test email" template.
 *
 * Two properties matter: it must be renderable while the deployment is still
 * being configured (i.e. with FRONTEND_URL unset — every other template that
 * carries a portal link throws in that state, by design), and admin-supplied
 * text must be escaped.
 */
import { describe, it, expect } from 'vitest';

// Must precede the config require below: these are CommonJS modules and a
// value set later would never be seen by src/config.
process.env.FRONTEND_URL = '';

const { testEmail, testEmailText } = require('../../src/utils/emailTemplates');

const details = {
  recipientName: 'Ana',
  host: 'smtp.gmail.com',
  port: 587,
  user: 'ops@example.com',
  from: 'noreply@example.com',
  frontendUrl: null,
  requestedBy: 'user #7',
  sentAt: '2026-10-06T00:00:00.000Z',
  message: 'Please confirm delivery.',
};

describe('testEmail template', () => {
  it('renders without a public site URL, unlike link-bearing templates', () => {
    expect(() => testEmail({})).not.toThrow();
    expect(() => testEmailText({})).not.toThrow();
  });

  it('states which SMTP server the message came through', () => {
    const html = testEmail(details);
    expect(html).toContain('smtp.gmail.com:587');
    expect(html).toContain('noreply@example.com');
    expect(html).toContain('user #7');
    expect(html).toContain('2026-10-06T00:00:00.000Z');
    expect(html).toContain('Email delivery is working');
  });

  it('explains a missing FRONTEND_URL instead of silently dropping links', () => {
    expect(testEmail(details)).toContain('FRONTEND_URL is not set');
    // When it is set, its value is reported instead.
    expect(testEmail({ ...details, frontendUrl: 'https://shop.example.test' }))
      .toContain('https://shop.example.test');
  });

  it('escapes admin-supplied text', () => {
    const html = testEmail({ ...details, message: '<script>alert(1)</script>', recipientName: '<b>Ana</b>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>Ana</b>');
  });

  it('omits the note block when the admin left it empty', () => {
    expect(testEmail({ ...details, message: '' })).not.toContain('Note from the administrator');
    expect(testEmail(details)).toContain('Note from the administrator');
    expect(testEmail(details)).toContain('Please confirm delivery.');
  });

  it('never leaves placeholders in the plain-text alternative', () => {
    const text = testEmailText(details);
    expect(text).toContain('smtp.gmail.com:587');
    expect(text).toContain('noreply@example.com');
    expect(text).toContain('user #7');
    expect(text).toContain('Please confirm delivery.');
    expect(text).not.toMatch(/undefined|NaN|\[object/);
  });
});
