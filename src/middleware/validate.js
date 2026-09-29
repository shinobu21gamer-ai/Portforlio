const ApiError = require('../utils/ApiError');

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((detail) => detail.message.replace(/"/g, ''));
      return next(ApiError.unprocessable('Validation failed', messages));
    }

    req[source] = value;
    next();
  };
};

module.exports = { validate };
