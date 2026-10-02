const { Op, fn, col, literal } = require('sequelize');
const { Sale, SaleItem, Purchase, Expense, PettyCashTransaction, sequelize } = require('../models');

const toLocalDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

class FinanceService {
  async getFinanceReport(startDate, endDate) {
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();
    const startStr = toLocalDateStr(start);
    const endStr = toLocalDateStr(end);
    const isSQLite = sequelize.getDialect() === 'sqlite';
    const nextDayExpr = isSQLite ? `date(:endDate, '+1 day')` : `DATE_ADD(DATE(:endDate), INTERVAL 1 DAY)`;
    const dateExpr = isSQLite ? 'DATE(s.created_at)' : 'DATE(s.created_at)';
    const expenseDateExpr = isSQLite ? 'DATE(expense_date)' : 'DATE(expense_date)';

    const [salesSummary, expensesSummary, taxSummary, cogsData, dailySummary] = await Promise.all([
      // Sales summary
      Sale.findOne({
        attributes: [
          [fn('COUNT', col('id')), 'totalSales'],
          [fn('COALESCE', fn('SUM', col('total')), 0), 'totalRevenue'],
          [fn('COALESCE', fn('SUM', col('subtotal')), 0), 'subtotal'],
          [fn('COALESCE', fn('SUM', col('discount_amount')), 0), 'totalDiscounts'],
          [fn('COALESCE', fn('SUM', col('tax_amount')), 0), 'totalTax'],
          [fn('COALESCE', fn('SUM', col('shipping_fee')), 0), 'totalShipping'],
        ],
        where: { createdAt: { [Op.between]: [start, end] }, status: 'completed' },
        raw: true,
      }),

      // Expenses summary
      Expense.findOne({
        attributes: [
          [fn('COALESCE', fn('SUM', col('amount')), 0), 'totalExpenses'],
          [fn('COUNT', col('id')), 'expenseCount'],
        ],
        where: { expenseDate: { [Op.between]: [startStr, endStr] } },
        raw: true,
      }),

      // Tax breakdown by payment method
      Sale.findAll({
        attributes: [
          'paymentMethod',
          [fn('COUNT', col('id')), 'count'],
          [fn('COALESCE', fn('SUM', col('total')), 0), 'total'],
          [fn('COALESCE', fn('SUM', col('tax_amount')), 0), 'tax'],
        ],
        where: { createdAt: { [Op.between]: [start, end] }, status: 'completed' },
        group: ['payment_method'],
        raw: true,
      }),

      // COGS (cost of goods sold) from sale items
      SaleItem.findOne({
        attributes: [
          [fn('COALESCE', fn('SUM', col('quantity')), 0), 'totalUnitsSold'],
          [fn('COALESCE', fn('SUM', literal('quantity * buying_price')), 0), 'totalCOGS'],
        ],
        include: [{ model: Sale, as: 'sale', attributes: [], where: { createdAt: { [Op.between]: [start, end] }, status: 'completed' } }],
        raw: true,
      }),

      // Daily P&L breakdown
      sequelize.query(`
        SELECT ${dateExpr} as date,
               COUNT(DISTINCT s.id) as sales,
               COALESCE(SUM(s.total), 0) as revenue,
               COALESCE(SUM(s.subtotal), 0) as subtotal,
               COALESCE(SUM(s.tax_amount), 0) as tax,
               COALESCE(SUM(s.discount_amount), 0) as discounts
        FROM sales s
        WHERE s.created_at >= date(:startDate) AND s.created_at < ${nextDayExpr} AND s.status = 'completed'
        GROUP BY ${dateExpr}
        ORDER BY ${dateExpr} ASC
      `, {
        replacements: { startDate: startStr, endDate: endStr },
        type: sequelize.QueryTypes.SELECT,
      }),
    ]);

    // Daily COGS from sale items (separate query to avoid join row multiplication)
    const dailyCogs = await sequelize.query(`
      SELECT ${dateExpr} as date,
             COALESCE(SUM(si.quantity * si.buying_price), 0) as cogs
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.created_at >= date(:startDate) AND s.created_at < ${nextDayExpr} AND s.status = 'completed'
      GROUP BY ${dateExpr}
      ORDER BY ${dateExpr} ASC
    `, {
      replacements: { startDate: startStr, endDate: endStr },
      type: sequelize.QueryTypes.SELECT,
    });

    // Get daily expenses
    const dailyExpenses = await sequelize.query(`
      SELECT ${expenseDateExpr} as date,
             COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE expense_date >= date(:startDate) AND expense_date < ${nextDayExpr}
      GROUP BY ${expenseDateExpr}
      ORDER BY ${expenseDateExpr} ASC
    `, {
      replacements: { startDate: startStr, endDate: endStr },
      type: sequelize.QueryTypes.SELECT,
    });

    const expenseMap = {};
    dailyExpenses.forEach(e => { expenseMap[e.date] = parseFloat(e.total || 0); });

    const cogsMap = {};
    dailyCogs.forEach(r => { cogsMap[r.date] = parseFloat(r.cogs || 0); });

    const totalRevenue = parseFloat(salesSummary?.totalRevenue || 0);
    const totalCOGS = parseFloat(cogsData?.totalCOGS || 0);
    const totalExpenses = parseFloat(expensesSummary?.totalExpenses || 0);
    const totalTax = parseFloat(salesSummary?.totalTax || 0);
    const totalDiscounts = parseFloat(salesSummary?.totalDiscounts || 0);
    const grossProfit = parseFloat(salesSummary?.subtotal || 0) - totalDiscounts - totalCOGS;
    const netProfit = grossProfit - totalExpenses;

    const dailyPnl = (dailySummary || []).map(d => {
      const dateStr = d.date;
      const dayExpenses = expenseMap[dateStr] || 0;
      const dayCOGS = cogsMap[dateStr] || 0;
      const dayGross = parseFloat(d.subtotal || 0) - parseFloat(d.discounts || 0) - dayCOGS;
      return {
        date: dateStr,
        sales: parseInt(d.sales || 0, 10),
        revenue: parseFloat(d.revenue || 0),
        subtotal: parseFloat(d.subtotal || 0),
        tax: parseFloat(d.tax || 0),
        discounts: parseFloat(d.discounts || 0),
        cogs: dayCOGS,
        grossProfit: parseFloat(dayGross.toFixed(2)),
        expenses: dayExpenses,
        netProfit: parseFloat((dayGross - dayExpenses).toFixed(2)),
      };
    });

    return {
      period: { start: startStr, end: endStr },
      summary: {
        totalRevenue,
        totalCOGS,
        grossProfit,
        totalExpenses,
        netProfit,
        totalTax,
        totalDiscounts,
        totalSales: parseInt(salesSummary?.totalSales || 0, 10),
        expenseCount: parseInt(expensesSummary?.expenseCount || 0, 10),
        profitMargin: totalRevenue > 0 ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(1)) : 0,
      },
      taxBreakdown: (taxSummary || []).map(t => ({
        method: t.paymentMethod || 'unknown',
        count: parseInt(t.count || 0, 10),
        total: parseFloat(t.total || 0),
        tax: parseFloat(t.tax || 0),
      })),
      dailyPnl,
    };
  }

  async getCashflow(startDate, endDate) {
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();
    const startStr = toLocalDateStr(start);
    const endStr = toLocalDateStr(end);

    const [salesCash, purchasePayments, expensePayments] = await Promise.all([
      // Cash received from sales
      Sale.findAll({
        attributes: [
          'paymentMethod',
          [fn('COUNT', col('id')), 'count'],
          [fn('COALESCE', fn('SUM', col('cash_amount')), 0), 'cashReceived'],
          [fn('COALESCE', fn('SUM', col('total')), 0), 'totalSales'],
        ],
        where: { createdAt: { [Op.between]: [start, end] }, status: 'completed' },
        group: ['payment_method'],
        raw: true,
      }),

      // Cash paid for purchases (exclude cancelled)
      Purchase.findOne({
        attributes: [
          [fn('COALESCE', fn('SUM', col('paid_amount')), 0), 'totalPaid'],
          [fn('COUNT', col('id')), 'count'],
        ],
        where: { createdAt: { [Op.between]: [start, end] }, status: { [Op.ne]: 'cancelled' } },
        raw: true,
      }),

      // Cash paid for expenses
      Expense.findAll({
        attributes: [
          'paymentMethod',
          [fn('COALESCE', fn('SUM', col('amount')), 0), 'total'],
          [fn('COUNT', col('id')), 'count'],
        ],
        where: { expenseDate: { [Op.between]: [startStr, endStr] } },
        group: ['payment_method'],
        raw: true,
      }),
    ]);

    // Petty cash fund movements (deposit = cash out, withdrawal = cash back in;
    // purchase-funded withdrawals are already counted under purchase cash-out)
    const [pettyDeposits, pettyWithdrawals] = await Promise.all([
      PettyCashTransaction.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'total']],
        where: { type: 'deposit', createdAt: { [Op.between]: [start, end] } },
        raw: true,
      }),
      PettyCashTransaction.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'total']],
        where: { type: 'withdrawal', referenceType: { [Op.ne]: 'Purchase' }, createdAt: { [Op.between]: [start, end] } },
        raw: true,
      }),
    ]);

    const totalCashIn = (salesCash || []).reduce((sum, s) => sum + parseFloat(s.cashReceived || 0), 0) + parseFloat(pettyWithdrawals?.total || 0);
    const totalPurchasePaid = parseFloat(purchasePayments?.totalPaid || 0);
    const totalExpensePaid = (expensePayments || []).reduce((sum, e) => sum + parseFloat(e.total || 0), 0);
    const totalPettyDeposits = parseFloat(pettyDeposits?.total || 0);
    const totalCashOut = totalPurchasePaid + totalExpensePaid + totalPettyDeposits;

    return {
      period: { start: startStr, end: endStr },
      cashIn: {
        total: totalCashIn,
        byMethod: (salesCash || []).map(s => ({
          method: s.paymentMethod || 'unknown',
          count: parseInt(s.count || 0, 10),
          amount: parseFloat(s.cashReceived || 0),
        })),
      },
      cashOut: {
        total: totalCashOut,
        purchases: { total: totalPurchasePaid, count: parseInt(purchasePayments?.count || 0, 10) },
        expenses: {
          total: totalExpensePaid,
          byMethod: (expensePayments || []).map(e => ({
            method: e.paymentMethod || 'unknown',
            count: parseInt(e.count || 0, 10),
            amount: parseFloat(e.total || 0),
          })),
        },
        pettyCash: {
          total: totalPettyDeposits,
          refunds: 0,
        },
      },
      netCashflow: parseFloat((totalCashIn - totalCashOut).toFixed(2)),
    };
  }
}

module.exports = new FinanceService();
