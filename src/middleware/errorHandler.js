const crypto = require('crypto');
const logger = require('../utils/logger');
const { sendError } = require('../utils/response');
const ApiError = require('../utils/ApiError');

const requestIdMiddleware = (req, res, next) => {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
};

const errorHandler = (err, req, res, next) => {
  const requestId = req.id || 'unknown';

  logger.error(`[${requestId}] ${err.stack || err.message}`);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors || null,
      requestId,
    });
  }

  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map((e) => (e.message || 'Validation failed'));
    return res.status(400).json({ success: false, message: 'Validation error', errors: messages, requestId });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const messages = err.errors.map(() => 'Value already exists');
    return res.status(409).json({ success: false, message: 'Duplicate entry', errors: messages, requestId });
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({ success: false, message: 'Invalid reference: related record not found', requestId });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token', requestId });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired', requestId });
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large', requestId });
    }
    return res.status(400).json({ success: false, message: err.message, requestId });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  return res.status(statusCode).json({ success: false, message, requestId });
};

module.exports = { requestIdMiddleware, errorHandler };
