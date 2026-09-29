const leaveService = require('../../services/hrms/leave.service');
const { sendSuccess } = require('../../utils/response');
const { Employee } = require('../../models');
const ApiError = require('../../utils/ApiError');

class LeaveController {
  async getAll(req, res, next) { try { sendSuccess(res, await leaveService.getAll(req.query)); } catch (e) { next(e); } }
  async getById(req, res, next) { try { sendSuccess(res, await leaveService.getById(req.params.id)); } catch (e) { next(e); } }
  async create(req, res, next) {
    try {
      const emp = await Employee.findOne({ where: { userId: req.user.id } });
      if (!emp) throw ApiError.notFound('No employee profile found for this user');
      sendSuccess(res, await leaveService.create({ ...req.body, employeeId: emp.id, userId: req.user.id }), 'Leave requested', 201);
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

  async updateBalance(req, res, next) {
    try {
      const { leaveType, totalDays } = req.body;
      const emp = await Employee.findByPk(req.params.employeeId);
      if (!emp) throw ApiError.notFound('Employee not found');
      sendSuccess(res, { message: 'Balance updated manually. Note: balances are auto-calculated from approved leaves.' });
    } catch (e) { next(e); }
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
