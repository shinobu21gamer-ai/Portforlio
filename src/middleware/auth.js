const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const config = require('../config');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const authService = require('../services/auth.service');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw ApiError.unauthorized('Not authenticated. Please log in.');
    }

    if (await authService.isTokenBlacklisted(token)) {
      throw ApiError.unauthorized('Token has been revoked. Please log in again.');
    }

    const decoded = await promisify(jwt.verify)(token, config.jwt.secret);

    const user = await User.findByPk(decoded.id, {
      include: [{ association: 'role' }],
    });

    if (!user) {
      throw ApiError.unauthorized('User no longer exists.');
    }

    if (!user.isActive) {
      throw ApiError.unauthorized('Account has been deactivated.');
    }

    if (user.passwordChangedAt) {
      const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
      if (decoded.iat < changedTimestamp) {
        throw ApiError.unauthorized('Password recently changed. Please log in again.');
      }
    }

    req.user = user;

    // First-run/seeded accounts are flagged mustChangePassword: they may
    // only change their password (and log out) until they pick their own.
    if (user.mustChangePassword && !['/change-password', '/logout'].includes(req.path)) {
      throw new ApiError(403, 'Password change required', { code: 'MUST_CHANGE_PASSWORD' });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Not authenticated.'));
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role.slug)) {
      return next(ApiError.forbidden('You do not have permission to perform this action.'));
    }

    next();
  };
};

const hasPermission = (...permissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Not authenticated.'));
    }

    const userWithPermissions = await User.findByPk(req.user.id, {
      include: {
        association: 'role',
        include: [{ association: 'permissions' }],
      },
    });

    if (!userWithPermissions || !userWithPermissions.role) {
      return next(ApiError.forbidden('No role assigned.'));
    }

    const userPermissions = userWithPermissions.role.permissions.map((p) => p.slug);
    const hasAll = permissions.every((p) => userPermissions.includes(p));

    if (!hasAll) {
      return next(ApiError.forbidden('Insufficient permissions.'));
    }

    next();
  };
};

module.exports = { protect, authorize, hasPermission };
