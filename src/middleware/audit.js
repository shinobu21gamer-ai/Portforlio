const { ActivityLog } = require('../models');

const SENSITIVE_FIELDS = ['password', 'token', 'cardNumber', 'cardExpiry', 'cardCvv', 'cvv', 'secret'];

const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object') return body;
  const clean = { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (field in clean) clean[field] = '[REDACTED]';
  }
  return clean;
};

const auditLog = (action, module) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    const reqBody = req.method !== 'GET' && req.method !== 'DELETE' ? { ...req.body } : null;

    res.json = async function (body) {
      try {
        if (req.user) {
          const isCreate = req.method === 'POST' && res.statusCode >= 200 && res.statusCode < 300;
          const isUpdate = (req.method === 'PUT' || req.method === 'PATCH') && res.statusCode >= 200 && res.statusCode < 300;
          const isDelete = req.method === 'DELETE' && res.statusCode >= 200 && res.statusCode < 300;

          await ActivityLog.create({
            userId: req.user.id,
            action,
            module,
            referenceType: req.params.id ? module.toLowerCase() : null,
            referenceId: req.params.id ? parseInt(req.params.id) : null,
            description: `${action} ${module}${req.params.id ? ` #${req.params.id}` : ''}`,
            requestMethod: req.method,
            requestUrl: req.originalUrl,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.headers['user-agent'],
            oldData: isUpdate ? sanitizeBody(reqBody) : null,
            newData: (isCreate || isUpdate) ? sanitizeBody(reqBody) : (isDelete ? { deleted: true } : null),
          });
        }
      } catch (err) {
        console.error(`Audit log failed (${action} ${module}): ${err.message}`);
      }
      return originalJson(body);
    };
    next();
  };
};

const manualAudit = async (userId, action, module, data = {}) => {
  try {
    await ActivityLog.create({
      userId,
      action,
      module,
      ...data,
    });
  } catch (err) {
    console.error(`Manual audit log failed (${action} ${module}): ${err.message}`);
  }
};

module.exports = { auditLog, manualAudit };
