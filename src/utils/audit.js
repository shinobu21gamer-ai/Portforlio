const { ActivityLog } = require('../models');

async function logActivity(userId, action, module, options = {}) {
  try {
    await ActivityLog.create({
      userId,
      action,
      module,
      referenceType: options.referenceType || null,
      referenceId: options.referenceId || null,
      description: options.description || null,
      requestMethod: options.requestMethod || null,
      requestUrl: options.requestUrl || null,
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null,
      oldData: options.oldData || null,
      newData: options.newData || null,
    });
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

module.exports = { logActivity };
