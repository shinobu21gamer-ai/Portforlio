const router = require('express').Router();
const config = require('../config');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const categoryRoutes = require('./category.routes');
const productRoutes = require('./product.routes');
const supplierRoutes = require('./supplier.routes');
const customerRoutes = require('./customer.routes');
const saleRoutes = require('./sale.routes');
const purchaseRoutes = require('./purchase.routes');
const inventoryRoutes = require('./inventory.routes');
const expenseRoutes = require('./expense.routes');
const expenseCategoryRoutes = require('./expenseCategory.routes');
const dashboardRoutes = require('./dashboard.routes');
const notificationRoutes = require('./notification.routes');
const activityRoutes = require('./activity.routes');
const hrmsRoutes = require('./hrms/index');
const publicJobRoutes = require('./hrms/publicJob.routes');
const roleRoutes = require('./role.routes');
const settingRoutes = require('./setting.routes');
const paymentRoutes = require('./payment');
const discountRoutes = require('./discount.routes');
const financeRoutes = require('./finance.routes');
const branchRoutes = require('./branch.routes');
const pettyCashRoutes = require('./pettyCash.routes');
const loyaltyRoutes = require('./loyalty.routes');
const shiftRoutes = require('./shift.routes');
const healthRoutes = require('./health.routes');
const { captureActivity } = require('../middleware/activityCapture');

const apiPrefix = config.apiPrefix;

// Capture every successful authenticated mutation as an audit event. Explicit
// service audit records mark the request context so this fallback won't double-log.
router.use(apiPrefix, captureActivity);
router.use(`${apiPrefix}/auth`, authRoutes);
router.use(`${apiPrefix}/users`, userRoutes);
router.use(`${apiPrefix}/categories`, categoryRoutes);
router.use(`${apiPrefix}/products`, productRoutes);
router.use(`${apiPrefix}/suppliers`, supplierRoutes);
router.use(`${apiPrefix}/customers`, customerRoutes);
router.use(`${apiPrefix}/sales`, saleRoutes);
router.use(`${apiPrefix}/purchases`, purchaseRoutes);
router.use(`${apiPrefix}/inventory`, inventoryRoutes);
router.use(`${apiPrefix}/expenses`, expenseRoutes);
router.use(`${apiPrefix}/expense-categories`, expenseCategoryRoutes);
router.use(`${apiPrefix}/dashboard`, dashboardRoutes);
router.use(`${apiPrefix}/notifications`, notificationRoutes);
router.use(`${apiPrefix}/activity-logs`, activityRoutes);
router.use(`${apiPrefix}/hrms`, hrmsRoutes);
router.use(`${apiPrefix}/hrms/notifications`, notificationRoutes);
router.use(`${apiPrefix}/public`, publicJobRoutes);
router.use(`${apiPrefix}/roles`, roleRoutes);
router.use(`${apiPrefix}/settings`, settingRoutes);
router.use(`${apiPrefix}/payments`, paymentRoutes);
router.use(`${apiPrefix}/discounts`, discountRoutes);
router.use(`${apiPrefix}/finance`, financeRoutes);
router.use(`${apiPrefix}/branches`, branchRoutes);
router.use(`${apiPrefix}/petty-cash`, pettyCashRoutes);
router.use(`${apiPrefix}/loyalty`, loyaltyRoutes);
router.use(`${apiPrefix}/shifts`, shiftRoutes);
// Operational diagnostics. /health (unauthenticated, liveness) lives in app.js;
// these are admin-only and report subsystem state rather than uptime.
router.use(`${apiPrefix}/health`, healthRoutes);

router.use(`${apiPrefix}/tracking`, require('./tracking.routes'));

router.use(`${apiPrefix}/*`, (req, res) => {
  res.status(404).json({ success: false, message: `API route not found: ${req.method} ${req.originalUrl}` });
});

module.exports = router;
