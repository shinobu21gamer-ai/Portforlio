const payrollService = require('../../services/hrms/payroll.service');
const { sendSuccess } = require('../../utils/response');

class PayrollController {
  async getAll(req, res, next) { try { sendSuccess(res, await payrollService.getAll(req.query)); } catch (e) { next(e); } }
  async getById(req, res, next) { try { sendSuccess(res, await payrollService.getById(req.params.id)); } catch (e) { next(e); } }
  async generate(req, res, next) { try { sendSuccess(res, await payrollService.generate(req.body), 'Payroll generated', 201); } catch (e) { next(e); } }
  async preview(req, res, next) { try { sendSuccess(res, await payrollService.preview(req.body)); } catch (e) { next(e); } }
  async previewGet(req, res, next) { try { sendSuccess(res, await payrollService.preview(req.query)); } catch (e) { next(e); } }
  async process(req, res, next) { try { sendSuccess(res, await payrollService.process(req.params.id), 'Payroll processed'); } catch (e) { next(e); } }
  async pay(req, res, next) { try { sendSuccess(res, await payrollService.pay(req.params.id), 'Payroll paid'); } catch (e) { next(e); } }
  async getPayslips(req, res, next) { try { sendSuccess(res, await payrollService.getPayslips(req.params.id)); } catch (e) { next(e); } }
  async exportCSV(req, res, next) {
    try {
      const csv = await payrollService.exportCSV(req.params.id);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payroll-${req.params.id}.csv"`);
      res.send(csv);
    } catch (e) { next(e); }
  }
}
module.exports = new PayrollController();
