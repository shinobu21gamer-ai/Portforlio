const ApiError = require('../utils/ApiError');

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    let result;
    try {
      result = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (e) {
      // A Joi *internal* error (e.g. a malformed schema reference) is a server
      // bug, not client input. Never let it escape as an unhandled 500 with
      // stack-trace leakage: log it, return a clean error.
      console.error(`[VALIDATE] Schema error on ${req.method} ${req.originalUrl}:`, e);
      return next(ApiError.internal('Request validation failed. Please try again.'));
    }

    const { error, value } = result;
    if (error) {
      const messages = error.details.map((detail) => detail.message.replace(/"/g, ''));
      return next(ApiError.unprocessable('Validation failed', messages));
    }

    req[source] = value;
    next();
  };
};

module.exports = { validate };
