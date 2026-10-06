const { ActivityLog } = require('../models');
const { markActivityLogged } = require('./activityContext');

// The optional transaction is honoured: an audit row written outside the
// caller's transaction would survive a rollback and claim an action that never
// happened. Several call sites already pass a transaction expecting this.
async function logActivity(userId, action, module, options = {}, transaction = null) {
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
    }, { transaction });
    markActivityLogged();
    return true;
  } catch (e) {
    console.error('Audit log failed:', e.message);
    return false;
  }
}

module.exports = { logActivity };
