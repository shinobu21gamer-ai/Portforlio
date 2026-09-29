const financeService = require('../services/finance.service');

class FinanceController {
  async getFinanceReport(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const report = await financeService.getFinanceReport(startDate, endDate);
      res.json({ data: report });
    } catch (err) {
      console.error('Finance report error:', err.message);
      res.status(500).json({ message: 'Failed to generate finance report' });
    }
  }

  async getCashflow(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const cashflow = await financeService.getCashflow(startDate, endDate);
      res.json({ data: cashflow });
    } catch (err) {
      console.error('Cashflow report error:', err.message);
      res.status(500).json({ message: 'Failed to generate cashflow report' });
    }
  }
}

module.exports = new FinanceController();
