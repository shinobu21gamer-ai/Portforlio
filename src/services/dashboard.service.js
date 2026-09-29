const { Op, fn, col, literal } = require('sequelize');
const {
  Sale, SaleItem, Product, Customer, Category, Expense, sequelize,
} = require('../models');

class DashboardService {
  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const [
      todaySalesResult,
      monthlySalesResult,
      lowStockProducts,
      customerCount,
      todayExpensesResult,
      monthlyExpensesResult,
    ] = await Promise.all([
      Sale.findOne({
        attributes: [
          [fn('COUNT', col('id')), 'totalSales'],
          [fn('COALESCE', fn('SUM', col('total')), 0), 'totalRevenue'],
          [fn('COALESCE', fn('SUM', col('profit')), 0), 'totalProfit'],
        ],
        where: { createdAt: { [Op.between]: [today, tomorrow] }, status: 'completed' },
        raw: true,
      }),
      Sale.findOne({
        attributes: [
          [fn('COUNT', col('id')), 'totalSales'],
          [fn('COALESCE', fn('SUM', col('total')), 0), 'totalRevenue'],
          [fn('COALESCE', fn('SUM', col('profit')), 0), 'totalProfit'],
        ],
        where: { createdAt: { [Op.gte]: monthStart }, status: 'completed' },
        raw: true,
      }),
      Product.findAll({
        where: {
          isActive: true,
          stockQuantity: { [Op.lte]: sequelize.col('min_stock_level') },
        },
        order: [['stockQuantity', 'ASC']],
        limit: 10,
      }),
      Customer.count({ where: { isActive: true } }),
      Expense.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'totalExpenses']],
        where: {
          expenseDate: { [Op.gte]: todayStr, [Op.lt]: tomorrowStr },
        },
        raw: true,
      }),
      Expense.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'totalExpenses']],
        where: {
          expenseDate: { [Op.gte]: monthStartStr },
        },
        raw: true,
      }),
    ]);

    const lowStock = lowStockProducts;

    let bestSellers = [];
    try {
      bestSellers = await SaleItem.findAll({
        attributes: [
          'productId',
          [fn('SUM', col('SaleItem.quantity')), 'totalSold'],
          [fn('SUM', col('SaleItem.total')), 'totalRevenue'],
        ],
        include: [
          { model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'image'] },
          { model: Sale, as: 'sale', attributes: [], required: true, where: { status: 'completed' } },
        ],
        group: ['SaleItem.product_id', 'product.id', 'product.name', 'product.sku', 'product.image'],
        order: [[literal('totalSold'), 'DESC']],
        limit: 10,
        subQuery: false,
      });
    } catch (e) {
      bestSellers = [];
    }

    let recentTransactions = [];
    try {
      recentTransactions = await Sale.findAll({
        include: [
          { model: Customer, as: 'customer', attributes: ['id', 'firstName', 'lastName'] },
          { model: require('../models').User, as: 'user', attributes: ['id', 'firstName', 'lastName'] },
        ],
        order: [['createdAt', 'DESC']],
        limit: 10,
      });
    } catch (e) {
      recentTransactions = [];
    }

    let dailySales = [];
    try {
      const isSQLite = sequelize.getDialect() === 'sqlite';
      const dateExpr = isSQLite ? "date(created_at)" : "DATE(created_at)";
      const dateParam = isSQLite ? `'${monthStartStr}'` : ':startDate';
      const rawDaily = await sequelize.query(`
        SELECT ${dateExpr} as date,
               COUNT(*) as sales,
               COALESCE(SUM(total), 0) as revenue,
               COALESCE(SUM(profit), 0) as profit
        FROM sales
        WHERE ${dateExpr} >= ${dateParam} AND status = 'completed'
        GROUP BY ${dateExpr}
        ORDER BY ${dateExpr} ASC
      `, {
        replacements: isSQLite ? {} : { startDate: monthStartStr },
        type: sequelize.QueryTypes.SELECT,
      });
      dailySales = rawDaily.map((d) => ({
        date: d.date,
        label: d.date,
        sales: parseInt(d.sales, 10),
        revenue: parseFloat(d.revenue || 0),
        profit: parseFloat(d.profit || 0),
      }));
    } catch (e) {
      dailySales = [];
    }

    let paymentMethods = [];
    try {
      const isSQLite = sequelize.getDialect() === 'sqlite';
      const dateExpr = isSQLite ? "date(created_at)" : "DATE(created_at)";
      const dateParam = isSQLite ? `'${monthStartStr}'` : ':startDate';
      const rawPayments = await sequelize.query(`
        SELECT payment_method as method,
               COUNT(*) as count,
               COALESCE(SUM(total), 0) as total
        FROM sales
        WHERE ${dateExpr} >= ${dateParam} AND status = 'completed'
        GROUP BY payment_method
      `, {
        replacements: isSQLite ? {} : { startDate: monthStartStr },
        type: sequelize.QueryTypes.SELECT,
      });
      paymentMethods = rawPayments.map((pm) => ({
        method: pm.method || 'unknown',
        count: parseInt(pm.count, 10),
        total: parseFloat(pm.total || 0),
      }));
    } catch (e) {
      paymentMethods = [];
    }

    let categorySales = [];
    try {
      const rawCatSales = await sequelize.query(`
        SELECT c.name as category,
               COALESCE(SUM(si.total), 0) as revenue,
               COALESCE(SUM(si.quantity), 0) as totalSold
        FROM sale_items si
        INNER JOIN sales s ON si.sale_id = s.id AND s.status = 'completed'
        INNER JOIN products p ON si.product_id = p.id
        INNER JOIN categories c ON p.category_id = c.id
        GROUP BY c.id, c.name
        ORDER BY revenue DESC
      `, { type: sequelize.QueryTypes.SELECT });
      categorySales = rawCatSales.map((cs) => ({
        category: cs.category || 'Unknown',
        totalRevenue: parseFloat(cs.revenue || 0),
        totalSold: parseInt(cs.totalSold || 0, 10),
      }));
    } catch (e) {
      categorySales = [];
    }

    const todayExpenses = parseFloat(todayExpensesResult?.totalExpenses || 0);
    const monthlyExpenses = parseFloat(monthlyExpensesResult?.totalExpenses || 0);
    const grossProfit = parseFloat(monthlySalesResult?.totalProfit || 0);
    const netProfit = grossProfit - monthlyExpenses;

    return {
      todaySales: {
        totalSales: parseInt(todaySalesResult?.totalSales || 0, 10),
        totalRevenue: parseFloat(todaySalesResult?.totalRevenue || 0),
        totalProfit: parseFloat(todaySalesResult?.totalProfit || 0),
      },
      monthlySales: {
        totalSales: parseInt(monthlySalesResult?.totalSales || 0, 10),
        totalRevenue: parseFloat(monthlySalesResult?.totalRevenue || 0),
        totalProfit: grossProfit,
        netProfit,
      },
      todayExpenses,
      monthlyExpenses,
      bestSellers: bestSellers.map((item) => ({
        productId: item.productId,
        productName: item.product?.name || 'Unknown',
        productSku: item.product?.sku || '',
        image: item.product?.image || null,
        totalSold: parseInt(item.dataValues?.totalSold || 0, 10),
        totalRevenue: parseFloat(item.dataValues?.totalRevenue || 0),
      })),
      lowStockProducts: lowStock.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stockQuantity: p.stockQuantity,
        minStockLevel: p.minStockLevel,
        image: p.image,
      })),
      totalCustomers: customerCount,
      recentTransactions: recentTransactions.map((s) => ({
        id: s.id,
        invoiceNo: s.invoiceNo,
        total: s.total,
        customer: s.customer
          ? `${s.customer.firstName} ${s.customer.lastName}`
          : 'Walk-in',
        cashier: s.user ? `${s.user.firstName} ${s.user.lastName}` : 'Unknown',
        createdAt: s.createdAt,
        status: s.status,
        paymentMethod: s.paymentMethod,
      })),
      dailySales,
      paymentMethods,
      categorySales,
    };
  }
}

module.exports = new DashboardService();
