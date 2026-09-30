const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');

class AuthController {
  async register(req, res, next) {
    try {
      const data = await authService.register(req.body);
      sendSuccess(res, { user: data.user, token: data.token, refreshToken: data.refreshToken }, 'Registration successful', 201);
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const data = await authService.login(req.body.email, req.body.password);
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('token', data.token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      if (data.refreshToken) {
        res.cookie('refreshToken', data.refreshToken, {
          httpOnly: true,
          secure: isProd,
          sameSite: isProd ? 'strict' : 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
      }
      sendSuccess(res, data, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
      sendSuccess(res, null, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const data = await authService.forgotPassword(req.body.email);
      sendSuccess(res, data, 'If the email exists, a reset link has been sent');
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      await authService.resetPassword(req.body.token, req.body.password);
      sendSuccess(res, null, 'Password reset successfully');
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const data = await authService.getProfile(req.user.id);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const data = await authService.updateProfile(req.user.id, req.body);
      sendSuccess(res, data, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const data = await authService.refreshAccessToken(req.body.refreshToken);
      sendSuccess(res, data, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace('Bearer ', '') : null;
      let refreshToken = req.body?.refreshToken || null;
      if (refreshToken === 'null' || refreshToken === '') refreshToken = null;
      await authService.logout(token, refreshToken, req.user?.id);
      res.clearCookie('token');
      res.clearCookie('refreshToken');
      sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async csrfToken(req, res, next) {
    try {
      const csrfToken = require('crypto').randomBytes(32).toString('hex');
      res.cookie('csrf_token', csrfToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
      sendSuccess(res, { csrfToken }, 'CSRF token generated');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
