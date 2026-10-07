const leaveService = require('../../services/hrms/leave.service');
const { sendSuccess } = require('../../utils/response');
const { Employee } = require('../../models');
const ApiError = require('../../utils/ApiError');

class LeaveController {
  async getAll(req, res, next) { try { sendSuccess(res, await leaveService.getAll(req.query)); } catch (e) { next(e); } }
  async getById(req, res, next) { try { sendSuccess(res, await leaveService.getById(req.params.id)); } catch (e) { next(e); } }
  async create(req, res, next) {
    try {
      // HR/admin (the Leaves screen) file requests *on behalf of* an employee, so
      // an explicit employeeId must be honoured. Self-service (/me/leaves) never
      // carries one — and must not: the caller's own profile is forced below so a
      // employee can never raise a leave against someone else.
      const roleSlug = req.user?.role?.slug;
      const selfService = (req.route?.path || req.path) === '/me/leaves';
      const canFileForOthers = !selfService && ['admin', 'hr', 'manager'].includes(roleSlug);
      let employeeId = canFileForOthers && req.body.employeeId ? Number(req.body.employeeId) : null;
      if (!employeeId) {
        const emp = await Employee.findOne({ where: { userId: req.user.id } });
        if (!emp) throw ApiError.notFound('No employee profile found for this user');
        employeeId = emp.id;
      }
      sendSuccess(res, await leaveService.create({ ...req.body, employeeId, userId: req.user.id }), 'Leave requested', 201);
    } catch (e) { next(e); }
  }
  async hrReview(req, res, next) { try { sendSuccess(res, await leaveService.hrReview(req.params.id, req.user.id, req.body.remarks)); } catch (e) { next(e); } }
  async adminApprove(req, res, next) { try { sendSuccess(res, await leaveService.adminApprove(req.params.id, req.user.id)); } catch (e) { next(e); } }
  async adminReject(req, res, next) { try { sendSuccess(res, await leaveService.adminReject(req.params.id, req.user.id, req.body.remarks)); } catch (e) { next(e); } }
  async cancel(req, res, next) { try { sendSuccess(res, await leaveService.cancel(req.params.id, req.user.id)); } catch (e) { next(e); } }
  async delete(req, res, next) { try { sendSuccess(res, await leaveService.delete(req.params.id)); } catch (e) { next(e); } }

  async getBalance(req, res, next) {
    try { sendSuccess(res, await leaveService.getLeaveBalance(req.params.employeeId)); } catch (e) { next(e); }
  }

  async getMyBalance(req, res, next) {
    try {
      const emp = await Employee.findOne({ where: { userId: req.user.id } });
      if (!emp) throw ApiError.notFound('No employee profile found');
      const balance = await leaveService.getLeaveBalance(emp.id);
      sendSuccess(res, balance);
    } catch (e) { next(e); }
  }
}

module.exports = new LeaveController();
