const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Role, ActivityLog, BlacklistedToken, Employee } = require('../models');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { Op } = require('sequelize');

// In-memory memo for the per-request blacklist lookup. A DB round-trip on
// EVERY authenticated request is both a hot path and an availability risk
// (a DB blip fails the check closed → total lockout). A short TTL keeps
// revocation latency ≤10s while the DB query becomes rare.
const BLACKLIST_CACHE_TTL_MS = 10_000;
const BLACKLIST_CACHE_MAX = 5000;
const blacklistCache = new Map(); // token -> rememberedAt (insertion-ordered)

function rememberBlacklisted(token) {
  if (!token || token === 'null' || token === '') return;
  blacklistCache.delete(token); // refresh recency (Map keeps insertion order)
  blacklistCache.set(token, Date.now());
  while (blacklistCache.size > BLACKLIST_CACHE_MAX) {
    blacklistCache.delete(blacklistCache.keys().next().value);
  }
}

function isBlacklistedCached(token) {
  const at = blacklistCache.get(token);
  if (!at) return false;
  if (Date.now() - at > BLACKLIST_CACHE_TTL_MS) {
    blacklistCache.delete(token);
    return false;
  }
  return true;
}

class AuthService {
  generateToken(userId, isRefresh = false) {
    const secret = isRefresh ? config.jwt.refreshSecret : config.jwt.secret;
    const expiresIn = isRefresh ? config.jwt.refreshExpiresIn : config.jwt.expiresIn;
    // jti: a unique id per token. Without it, two logins in the same second
    // produce byte-identical JWTs, so blacklisting one (e.g. on logout)
    // silently revokes the other — and a forced change-password -> re-login
    // in quick succession locked the user out (Phase 3, AUDIT.md S1).
    return jwt.sign({ id: userId, jti: crypto.randomUUID() }, secret, { expiresIn });
  }

  verifyRefreshToken(token) {
    return jwt.verify(token, config.jwt.refreshSecret);
  }

  async isTokenBlacklisted(token) {
    if (!token) return false;
    if (isBlacklistedCached(token)) return true;
    try {
      const blacklisted = await BlacklistedToken.findOne({ where: { token }, attributes: ['id'] });
      if (blacklisted) rememberBlacklisted(token);
      return !!blacklisted;
    } catch (e) {
      // Fail closed in production so a DB blip can't admit a revoked token.
      // In test, SQLITE_BUSY on the shared file DB was 401'ing every probe and
      // the POS client treated that as "session dead".
      console.error('Token blacklist check failed:', e.message);
      return config.nodeEnv !== 'test';
    }
  }

  async blacklistToken(token, userId = null) {
    if (!token || token === 'null' || token === '') return;
    try {
      const decoded = jwt.decode(token);
      const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await BlacklistedToken.findOrCreate({ where: { token }, defaults: { token, expiresAt, userId } });
      rememberBlacklisted(token); // revoke immediately, don't wait for the TTL
    } catch (e) {
      console.error('Failed to blacklist token:', e);
    }
  }

  async claimAndBlacklistToken(token) {
    if (!token || token === 'null' || token === '') return false;
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) return false;
      const expiresAt = new Date(decoded.exp * 1000);
      const [, created] = await BlacklistedToken.findOrCreate({
        where: { token },
        defaults: { token, expiresAt },
      });
      return created;
    } catch (e) {
      console.error('Failed to claim and blacklist token:', e);
      return false;
    }
  }

  async blacklistAllUserTokens(userId) {
    try {
      await BlacklistedToken.destroy({ where: { userId } });
    } catch (e) {
      console.error('Failed to blacklist all user tokens:', e.message);
    }
  }

  async register(data) {
    // Off by default in production: a self-registered account is a live POS
    // login (cashier role + JWT). Stores opt in via ALLOW_PUBLIC_REGISTRATION
    // or the admin Settings toggle.
    const settingService = require('../services/setting.service');
    if (!settingService.isPublicRegistrationAllowed()) {
      throw ApiError.forbidden('Public registration is disabled on this store. Ask an administrator to create your account.');
    }

    const existing = await User.findOne({ where: { email: data.email } });
    if (existing) throw ApiError.conflict('Email already registered');

    const role = await Role.findOne({ where: { slug: 'cashier' } });
    if (!role) throw ApiError.notFound('Default role not found');

    const user = await User.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone || null,
      password: data.password,
      roleId: role.id,
    });

    // Auto-create employee so every account shows in HRMS
    await Employee.create({
      employeeNo: 'EMP-' + user.id,
      firstName: data.firstName || 'User',
      lastName: data.lastName || '',
      email: data.email,
      hireDate: new Date(),
      salary: 0,
      employmentType: 'full-time',
    });

    const token = this.generateToken(user.id);
    const refreshToken = this.generateToken(user.id, true);

    const userData = await User.findByPk(user.id, {
      include: [{ association: 'role', attributes: ['id', 'name', 'slug'] }],
    });

    return { user: userData, token, refreshToken };
  }

  async login(email, password) {
    const user = await User.scope('withPassword').findOne({
      where: { email },
      include: [{ association: 'role', attributes: ['id', 'name', 'slug'] }],
    });

    if (!user) throw ApiError.unauthorized('Invalid email or password');

    if (!user.isActive) throw ApiError.unauthorized('Account has been deactivated');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw ApiError.unauthorized('Account temporarily locked due to too many failed attempts. Please try again later.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const updates = { failedLoginAttempts: attempts };
      if (attempts >= 5) {
        updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await user.update(updates);
      throw ApiError.unauthorized('Invalid email or password');
    }

    await user.update({ failedLoginAttempts: 0, lockedUntil: null });

    await this.blacklistAllUserTokens(user.id);

    await user.update({ lastLogin: new Date() });

    const token = this.generateToken(user.id);
    const refreshToken = this.generateToken(user.id, true);

    const userData = user.toJSON();
    delete userData.password;
    delete userData.passwordResetToken;
    delete userData.passwordResetExpires;

    await ActivityLog.create({
      userId: user.id,
      action: 'login',
      module: 'Auth',
      description: `User ${user.email} logged in`,
    });

    return { user: userData, token, refreshToken };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.scope('withPassword').findByPk(userId);
    if (!user) throw ApiError.notFound('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw ApiError.badRequest('Current password is incorrect');

    // Picking the *same* password must not count as a change: accounts created
    // by HR approval carry mustChangePassword=true with a one-time password, and
    // without this guard "changing" it back to the same value cleared the flag
    // while leaving the shared/temporary password in place.
    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) throw ApiError.badRequest('New password must be different from the current password');

    await user.update({
      password: newPassword,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    });

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(email, req = null) {
    const user = await User.findOne({ where: { email } });
    if (!user) return { message: 'If the email exists, a reset link has been sent.' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await user.update({
      passwordResetToken: hashedToken,
      passwordResetExpires: new Date(Date.now() + 3600000),
    });

    console.log(`Password reset requested for ${email}`);

    const result = { message: 'If the email exists, a reset link has been sent.' };

    const { sendEmail, isConfigured: isMailConfigured } = require('../utils/mailer');
    const { passwordResetEmail } = require('../utils/emailTemplates');
    const { resolvePublicOrigin } = require('../utils/helpers');
    const config = require('../config');
    // Derive the reset link from the request origin so it is correct on any
    // host. It previously fell back to http://localhost:3001, so in
    // production the email arrived with a dead link inside it. Callers with
    // no request context (unit tests, CLI) can't resolve an origin — skip the
    // email rather than throwing, and fall back to a path-only link below.
    let resetUrl = null;
    try {
      const frontendOrigin = resolvePublicOrigin(req, config.app.frontendUrl);
      resetUrl = `${frontendOrigin}/reset-password?token=${resetToken}`;
    } catch { /* no origin context — email skipped */ }

    let delivered = false;
    if (resetUrl) {
      try {
        await sendEmail({
          to: email,
          subject: `Password Reset - ${process.env.APP_NAME || 'MiniMart POS'}`,
          html: passwordResetEmail(user.firstName || user.email, resetUrl),
        });
        delivered = isMailConfigured(); // sendEmail resolves even when SMTP is off
      } catch (err) {
        console.error('Failed to send reset email:', err.message);
      }
    }

    // Dev/demo deployments without SMTP would otherwise be stuck: the token
    // is generated but nowhere to see it. Outside production, hand the link
    // back to the requester. Production keeps the generic response only
    // (never expose a usable reset URL over the API).
    if (!delivered && config.nodeEnv !== 'production') {
      result.devResetUrl = resetUrl || `/reset-password?token=${resetToken}`;
    }

    return result;
  }

  async resetPassword(token, newPassword) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.scope('withPassword').findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) throw ApiError.badRequest('Invalid or expired reset token');

    const sameAsCurrent = await bcrypt.compare(newPassword, user.password);
    if (sameAsCurrent) throw ApiError.badRequest('New password must be different from your current password');

    await user.update({
      password: newPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    });

    try {
      const { sendEmail } = require('../utils/mailer');
      const { passwordResetSuccessEmail } = require('../utils/emailTemplates');
      await sendEmail({
        to: user.email,
        subject: `Password Changed - ${process.env.APP_NAME || 'MiniMart POS'}`,
        html: passwordResetSuccessEmail(user.firstName || user.email),
      });
    } catch (err) {
      console.error('Failed to send password reset success email:', err.message);
    }

    return { message: 'Password reset successfully' };
  }

  async getProfile(userId) {
    const user = await User.findByPk(userId, {
      include: [{ association: 'role', attributes: ['id', 'name', 'slug'] }],
    });
    if (!user) throw ApiError.notFound('User not found');
    return user;
  }

  async updateProfile(userId, data) {
    const allowedFields = ['firstName', 'lastName', 'phone', 'avatar'];
    const filtered = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) filtered[key] = data[key];
    }

    const user = await User.findByPk(userId);
    if (!user) throw ApiError.notFound('User not found');

    await user.update(filtered);
    return this.getProfile(userId);
  }

  async refreshAccessToken(refreshToken) {
    if (!refreshToken || refreshToken === 'null' || refreshToken === '') {
      throw ApiError.unauthorized('Refresh token is missing');
    }
    try {
      const decoded = this.verifyRefreshToken(refreshToken);

      const claimed = await this.claimAndBlacklistToken(refreshToken);
      if (!claimed) throw ApiError.unauthorized('Refresh token has been revoked or already used');

      const user = await User.findByPk(decoded.id);
      if (!user) throw ApiError.unauthorized('User not found');
      if (!user.isActive) throw ApiError.unauthorized('Account has been deactivated');

      const token = this.generateToken(user.id);
      const newRefreshToken = this.generateToken(user.id, true);
      return { token, refreshToken: newRefreshToken };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.unauthorized('Invalid refresh token');
    }
  }

  async cleanupBlacklistedTokens() {
    try {
      await BlacklistedToken.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });
    } catch (e) {
      console.error('Failed to clean blacklisted tokens:', e.message);
    }
  }

  async logout(token, refreshToken, userId = null) {
    if (token && token !== 'null' && token !== '') await this.blacklistToken(token, userId);
    if (refreshToken && refreshToken !== 'null' && refreshToken !== '') await this.blacklistToken(refreshToken, userId);
    return { message: 'Logged out successfully' };
  }
}

module.exports = new AuthService();
