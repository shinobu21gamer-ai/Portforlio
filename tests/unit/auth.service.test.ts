import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

// Ensure env vars persist through test execution
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-ci-only-32chars';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../src/models');
const { sequelize, User, Role, BlacklistedToken } = models;
const authService = require('../../src/services/auth.service');

let cashierRole;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  cashierRole = await Role.create({ name: 'Cashier', slug: 'cashier' });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await BlacklistedToken.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
});

describe('auth.service - register', () => {
  it('creates a new user with hashed password', async () => {
    const result = await authService.register({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      password: 'password123',
    });

    expect(result.user.email).toBe('john@test.local');
    expect(result.user.firstName).toBe('John');
    expect(result.token).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.password).toBeUndefined();

    const stored = await User.scope('withPassword').findByPk(result.user.id);
    expect(stored.password).not.toBe('password123');
  });

  it('rejects duplicate email', async () => {
    await authService.register({
      firstName: 'First',
      lastName: 'User',
      email: 'dupe@test.local',
      password: 'pass1',
    });

    await expect(
      authService.register({
        firstName: 'Second',
        lastName: 'User',
        email: 'dupe@test.local',
        password: 'pass2',
      })
    ).rejects.toThrow(/already registered/i);
  });
});

describe('auth.service - login', () => {
  it('returns user and tokens for valid credentials', async () => {
    await authService.register({
      firstName: 'Alice',
      lastName: 'Test',
      email: 'alice@test.local',
      password: 'validpass',
    });

    const result = await authService.login('alice@test.local', 'validpass');

    expect(result.user.email).toBe('alice@test.local');
    expect(result.token).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.password).toBeUndefined();
  });

  it('rejects invalid password', async () => {
    await authService.register({
      firstName: 'Bob',
      lastName: 'Test',
      email: 'bob@test.local',
      password: 'correct',
    });

    await expect(authService.login('bob@test.local', 'wrong')).rejects.toThrow(/Invalid email or password/i);
  });

  it('rejects unknown email', async () => {
    await expect(authService.login('ghost@test.local', 'anypass')).rejects.toThrow(/Invalid email or password/i);
  });

  it('locks account after 5 failed attempts', async () => {
    await authService.register({
      firstName: 'Charlie',
      lastName: 'Test',
      email: 'charlie@test.local',
      password: 'correct',
    });

    for (let i = 0; i < 5; i++) {
      await authService.login('charlie@test.local', 'wrong').catch(() => {});
    }

    await expect(authService.login('charlie@test.local', 'correct')).rejects.toThrow(/locked/i);
  });

  it('resets failed attempts on successful login', async () => {
    await authService.register({
      firstName: 'Dan',
      lastName: 'Test',
      email: 'dan@test.local',
      password: 'correct',
    });

    await authService.login('dan@test.local', 'wrong').catch(() => {});
    await authService.login('dan@test.local', 'wrong').catch(() => {});

    const result = await authService.login('dan@test.local', 'correct');
    const user = await User.findByPk(result.user.id);
    expect(user.failedLoginAttempts).toBe(0);
  });

  it('rejects inactive account', async () => {
    const { user } = await authService.register({
      firstName: 'Eve',
      lastName: 'Test',
      email: 'eve@test.local',
      password: 'pass',
    });

    await User.update({ isActive: false }, { where: { id: user.id } });

    await expect(authService.login('eve@test.local', 'pass')).rejects.toThrow(/deactivated/i);
  });
});

describe('auth.service - token generation', () => {
  it('generates access token with correct payload', async () => {
    const { user } = await authService.register({
      firstName: 'Token',
      lastName: 'User',
      email: 'token@test.local',
      password: 'pass',
    });

    const token = authService.generateToken(user.id);
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    expect(decoded.id).toBe(user.id);
  });

  it('generates refresh token with longer expiry', async () => {
    const { user } = await authService.register({
      firstName: 'Refresh',
      lastName: 'User',
      email: 'refresh@test.local',
      password: 'pass',
    });

    const refreshToken = authService.generateToken(user.id, true);
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    expect(decoded.id).toBe(user.id);
    expect(decoded.exp - decoded.iat).toBeGreaterThan(3600);
  });
});

describe('auth.service - token blacklist', () => {
  it('blacklists a token', async () => {
    const { token } = await authService.register({
      firstName: 'Black',
      lastName: 'List',
      email: 'blacklist@test.local',
      password: 'pass',
    });

    await authService.blacklistToken(token);

    const isBlacklisted = await authService.isTokenBlacklisted(token);
    expect(isBlacklisted).toBe(true);
  });

  it('returns false for non-blacklisted token', async () => {
    const { token } = await authService.register({
      firstName: 'Clean',
      lastName: 'Token',
      email: 'clean@test.local',
      password: 'pass',
    });

    const isBlacklisted = await authService.isTokenBlacklisted(token);
    expect(isBlacklisted).toBe(false);
  });

  it('ignores empty token on blacklist', async () => {
    await authService.blacklistToken('');
    await authService.blacklistToken(null);
    await authService.blacklistToken('null');

    const count = await BlacklistedToken.count();
    expect(count).toBe(0);
  });
});

describe('auth.service - logout', () => {
  it('blacklists both tokens on logout', async () => {
    const { token, refreshToken } = await authService.register({
      firstName: 'Logout',
      lastName: 'User',
      email: 'logout@test.local',
      password: 'pass',
    });

    await authService.logout(token, refreshToken);

    expect(await authService.isTokenBlacklisted(token)).toBe(true);
    expect(await authService.isTokenBlacklisted(refreshToken)).toBe(true);
  });
});

describe('auth.service - refresh token', () => {
  it('issues new tokens for valid refresh token', async () => {
    const { refreshToken: oldRefresh, user } = await authService.register({
      firstName: 'Refresh',
      lastName: 'Test',
      email: 'refreshtest@test.local',
      password: 'pass',
    });

    await new Promise(resolve => setTimeout(resolve, 1100));

    const result = await authService.refreshAccessToken(oldRefresh);

    expect(result.token).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.token).not.toBe(oldRefresh);

    const isOldBlacklisted = await authService.isTokenBlacklisted(oldRefresh);
    expect(isOldBlacklisted).toBe(true);
  });

  it('blacklists old refresh token after use', async () => {
    const { refreshToken } = await authService.register({
      firstName: 'Once',
      lastName: 'Use',
      email: 'once@test.local',
      password: 'pass',
    });

    await authService.refreshAccessToken(refreshToken);

    expect(await authService.isTokenBlacklisted(refreshToken)).toBe(true);
  });

  it('rejects reused refresh token', async () => {
    const { refreshToken } = await authService.register({
      firstName: 'Reuse',
      lastName: 'Test',
      email: 'reuse@test.local',
      password: 'pass',
    });

    await authService.refreshAccessToken(refreshToken);

    await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow(/revoked or already used/i);
  });

  it('rejects empty refresh token', async () => {
    await expect(authService.refreshAccessToken('')).rejects.toThrow(/missing/i);
    await expect(authService.refreshAccessToken(null)).rejects.toThrow(/missing/i);
    await expect(authService.refreshAccessToken('null')).rejects.toThrow(/missing/i);
  });

  it('rejects refresh token for inactive user', async () => {
    const { refreshToken, user } = await authService.register({
      firstName: 'Inactive',
      lastName: 'Refresh',
      email: 'inactive-refresh@test.local',
      password: 'pass',
    });

    await User.update({ isActive: false }, { where: { id: user.id } });

    await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow(/deactivated/i);
  });
});

describe('auth.service - change password', () => {
  it('updates password when current password is correct', async () => {
    const { user } = await authService.register({
      firstName: 'Change',
      lastName: 'Pass',
      email: 'changepass@test.local',
      password: 'oldpass',
    });

    await authService.changePassword(user.id, 'oldpass', 'newpass');

    const result = await authService.login('changepass@test.local', 'newpass');
    expect(result.user.id).toBe(user.id);
  });

  it('rejects incorrect current password', async () => {
    const { user } = await authService.register({
      firstName: 'Wrong',
      lastName: 'Current',
      email: 'wrongcurrent@test.local',
      password: 'correct',
    });

    await expect(authService.changePassword(user.id, 'wrong', 'new')).rejects.toThrow(/incorrect/i);
  });
});

describe('auth.service - forgot password', () => {
  it('returns generic message for unknown email', async () => {
    const result = await authService.forgotPassword('unknown@test.local');
    expect(result.message).toMatch(/If the email exists/i);
  });

  it('sets reset token for known email', async () => {
    await authService.register({
      firstName: 'Forgot',
      lastName: 'User',
      email: 'forgot@test.local',
      password: 'pass',
    });

    const result = await authService.forgotPassword('forgot@test.local');
    expect(result.message).toMatch(/If the email exists/i);

    const user = await User.scope('withPassword').findOne({ where: { email: 'forgot@test.local' } });
    expect(user.passwordResetToken).toBeDefined();
    expect(user.passwordResetExpires).toBeDefined();
  });
});

describe('auth.service - reset password', () => {
  it('resets password with valid token', async () => {
    await authService.register({
      firstName: 'Reset',
      lastName: 'User',
      email: 'reset@test.local',
      password: 'oldpass',
    });

    await authService.forgotPassword('reset@test.local');

    const user = await User.scope('withPassword').findOne({ where: { email: 'reset@test.local' } });
    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    await user.update({ passwordResetToken: hashedToken, passwordResetExpires: new Date(Date.now() + 3600000) });

    await authService.resetPassword(rawToken, 'newpass');

    const result = await authService.login('reset@test.local', 'newpass');
    expect(result.user.email).toBe('reset@test.local');
  });

  it('rejects expired token', async () => {
    await authService.register({
      firstName: 'Expired',
      lastName: 'Token',
      email: 'expired@test.local',
      password: 'pass',
    });

    const user = await User.scope('withPassword').findOne({ where: { email: 'expired@test.local' } });
    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    await user.update({ passwordResetToken: hashedToken, passwordResetExpires: new Date(Date.now() - 1000) });

    await expect(authService.resetPassword(rawToken, 'newpass')).rejects.toThrow(/expired/i);
  });

  it('rejects invalid token', async () => {
    await expect(authService.resetPassword('invalid-token', 'newpass')).rejects.toThrow(/Invalid or expired/i);
  });
});

describe('auth.service - profile', () => {
  it('retrieves user profile', async () => {
    const { user } = await authService.register({
      firstName: 'Profile',
      lastName: 'User',
      email: 'profile@test.local',
      password: 'pass',
    });

    const profile = await authService.getProfile(user.id);
    expect(profile.email).toBe('profile@test.local');
    expect(profile.firstName).toBe('Profile');
  });

  it('updates allowed profile fields', async () => {
    const { user } = await authService.register({
      firstName: 'Update',
      lastName: 'Profile',
      email: 'updateprofile@test.local',
      password: 'pass',
    });

    const updated = await authService.updateProfile(user.id, {
      firstName: 'Changed',
      phone: '123456',
      avatar: 'avatar.jpg',
    });

    expect(updated.firstName).toBe('Changed');
    expect(updated.phone).toBe('123456');
    expect(updated.avatar).toBe('avatar.jpg');
  });

  it('ignores disallowed profile fields', async () => {
    const { user } = await authService.register({
      firstName: 'Ignore',
      lastName: 'Field',
      email: 'ignorefield@test.local',
      password: 'pass',
    });

    await authService.updateProfile(user.id, {
      email: 'hacked@test.local',
      roleId: 999,
    });

    const profile = await authService.getProfile(user.id);
    expect(profile.email).toBe('ignorefield@test.local');
    expect(profile.roleId).toBe(cashierRole.id);
  });
});
