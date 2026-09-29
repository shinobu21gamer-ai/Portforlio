const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Role, ActivityLog, BlacklistedToken, Employee } = require('../models');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class AuthService {
  generateToken(userId) {
    return jwt.sign({ id: userId }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  generateRefreshToken(userId) {
    return jwt.sign({ id: userId }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });
  }

  verifyRefreshToken(token) {
    return jwt.verify(token, config.jwt.refreshSecret);
  }

  async isTokenBlacklisted(token) {
    try {
      const blacklisted = await BlacklistedToken.findOne({ where: { token } });
      return !!blacklisted;
    } catch (e) {
      logger.error('Token blacklist check failed:', e.message);
      return true;
    }
  }

  async blacklistToken(token) {
    if (!token || token === 'null' || token === '') return;
    try {
      const decoded = jwt.decode(token);
      const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await BlacklistedToken.findOrCreate({ where: { token }, defaults: { token, expiresAt } });
    } catch (e) {
      logger.error('Failed to blacklist token:', e);
    }
  }

  async register(data) {
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
    const refreshToken = this.generateRefreshToken(user.id);

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

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw ApiError.unauthorized('Invalid email or password');

    await user.update({ lastLogin: new Date() });

    const token = this.generateToken(user.id);
    const refreshToken = this.generateRefreshToken(user.id);

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

    await user.update({
      password: newPassword,
      passwordChangedAt: new Date(),
    });

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(email) {
    const user = await User.findOne({ where: { email } });
    if (!user) return { message: 'If the email exists, a reset link has been sent.' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await user.update({
      passwordResetToken: hashedToken,
      passwordResetExpires: new Date(Date.now() + 3600000),
    });

    logger.info(`Password reset requested for ${email}`);

    const result = { message: 'If the email exists, a reset link has been sent.' };

    try {
      const { sendEmail } = require('../utils/mailer');
      const { passwordResetEmail } = require('../utils/emailTemplates');
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${resetToken}`;
      await sendEmail({
        to: email,
        subject: `Password Reset - ${process.env.APP_NAME || 'MiniMart POS'}`,
        html: passwordResetEmail(user.firstName || user.email, resetUrl),
      });
    } catch (err) {
      logger.error('Failed to send reset email:', err.message);
    }

    if (process.env.NODE_ENV !== 'production') {
      result.resetToken = resetToken;
    }

    return result;
  }

  async resetPassword(token, newPassword) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.scope('withPassword').findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [require('sequelize').Op.gt]: new Date() },
      },
    });

    if (!user) throw ApiError.badRequest('Invalid or expired reset token');

    await user.update({
      password: newPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      passwordChangedAt: new Date(),
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
      logger.error('Failed to send password reset success email:', err.message);
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

      const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
      if (isBlacklisted) throw ApiError.unauthorized('Refresh token has been revoked');

      const user = await User.findByPk(decoded.id);
      if (!user) throw ApiError.unauthorized('User not found');
      if (!user.isActive) throw ApiError.unauthorized('Account has been deactivated');

      await this.blacklistToken(refreshToken);

      const token = this.generateToken(user.id);
      const newRefreshToken = this.generateRefreshToken(user.id);
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
      logger.error('Failed to clean blacklisted tokens:', e.message);
    }
  }

  async logout(token, refreshToken) {
    if (token && token !== 'null' && token !== '') await this.blacklistToken(token);
    if (refreshToken && refreshToken !== 'null' && refreshToken !== '') await this.blacklistToken(refreshToken);
    return { message: 'Logged out successfully' };
  }
}

module.exports = new AuthService();
