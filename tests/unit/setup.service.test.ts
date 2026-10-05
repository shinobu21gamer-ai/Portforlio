import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Must be set before any src module is required.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-ci-only-32chars';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../src/models');
const { sequelize, User, Role } = models;
const { ensureFirstAdmin, resolveFirstAdmin, MIN_PASSWORD_LENGTH } =
  require('../../src/services/setup.service');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ where: {}, force: true });
  await Role.destroy({ where: {}, force: true });
  vi.unstubAllEnvs();
});

describe('resolveFirstAdmin', () => {
  it('uses the provided env credentials and lowercases the email', () => {
    const r = resolveFirstAdmin({
      INITIAL_ADMIN_EMAIL: 'Root@Example.com',
      INITIAL_ADMIN_PASSWORD: 'Str0ngPassw0rd',
    });
    expect(r.email).toBe('root@example.com');
    expect(r.password).toBe('Str0ngPassw0rd');
    expect(r.generated).toBe(false);
  });

  it('generates a 32-hex one-time password when none is provided', () => {
    const r = resolveFirstAdmin({});
    expect(r.generated).toBe(true);
    expect(r.email).toBe('admin@minimart.com');
    expect(r.password).toMatch(/^[a-f0-9]{32}$/);
  });

  it('treats a too-short provided password as "not provided"', () => {
    const r = resolveFirstAdmin({ INITIAL_ADMIN_PASSWORD: 'short' });
    expect(r.generated).toBe(true);
    expect(r.password).not.toBe('short');
  });

  it('accepts a provided password at the minimum length', () => {
    const pw = 'aA1'.repeat(4).slice(0, MIN_PASSWORD_LENGTH);
    const r = resolveFirstAdmin({ INITIAL_ADMIN_PASSWORD: pw });
    expect(r.generated).toBe(false);
    expect(r.password).toBe(pw);
  });

  it('never returns the same generated password twice', () => {
    expect(resolveFirstAdmin({}).password).not.toBe(resolveFirstAdmin({}).password);
  });
});

describe('ensureFirstAdmin', () => {
  it('creates a flagged admin when the users table is empty', async () => {
    vi.stubEnv('INITIAL_ADMIN_PASSWORD', 'Gen0ratedPass');

    const result = await ensureFirstAdmin();
    expect(result).not.toBeNull();
    expect(result?.generated).toBe(false);

    const user: any = await User.findOne({
      where: { email: 'admin@minimart.com' },
      include: ['role'],
    });
    expect(user).not.toBeNull();
    expect(user.mustChangePassword).toBe(true);
    expect(user.isActive).toBe(true);
    expect(user.role.slug).toBe('admin');
    // password is stored hashed (bcrypt), never in plain text
    const hashed: any = await User.scope('withPassword').findOne({
      where: { email: 'admin@minimart.com' },
    });
    expect(hashed.password).toMatch(/^\$2[aby]\$/);
    expect(hashed.password).not.toContain('Gen0ratedPass');
  });

  it('uses the generated-password path when INITIAL_ADMIN_PASSWORD is unset', async () => {
    vi.stubEnv('INITIAL_ADMIN_PASSWORD', '');
    vi.stubEnv('INITIAL_ADMIN_EMAIL', 'custom-admin@example.com');

    const result = await ensureFirstAdmin();
    expect(result?.generated).toBe(true);
    expect(result?.email).toBe('custom-admin@example.com');
    expect(await User.count()).toBe(1);
  });

  it('is a no-op when users already exist', async () => {
    const role = await Role.create({ name: 'Cashier', slug: 'cashier', isActive: true });
    await User.create({
      firstName: 'A',
      lastName: 'B',
      email: 'existing@example.com',
      password: 'Passw0rd!123',
      roleId: role.id,
      isActive: true,
    });

    const result = await ensureFirstAdmin();
    expect(result).toBeNull();
    expect(await User.count()).toBe(1);
    // the pre-existing user is untouched
    const u: any = await User.findOne({ where: { email: 'existing@example.com' } });
    expect(u.mustChangePassword).toBe(false);
  });

  it('is idempotent across restarts (second call is a no-op)', async () => {
    await ensureFirstAdmin();
    const again = await ensureFirstAdmin();
    expect(again).toBeNull();
    expect(await User.count()).toBe(1);
  });
});
