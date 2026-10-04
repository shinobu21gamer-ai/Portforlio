const scheduleService = require('../../services/hrms/schedule.service');
const { sendSuccess } = require('../../utils/response');

class ScheduleController {
  async getAll(req, res, next) { try { sendSuccess(res, await scheduleService.getAll(req.query)); } catch (e) { next(e); } }
  async getById(req, res, next) { try { sendSuccess(res, await scheduleService.getById(req.params.id)); } catch (e) { next(e); } }
  async create(req, res, next) { try { sendSuccess(res, await scheduleService.create(req.body, req.user?.id), 'Created', 201); } catch (e) { next(e); } }
  async update(req, res, next) { try { sendSuccess(res, await scheduleService.update(req.params.id, req.body, req.user?.id), 'Updated'); } catch (e) { next(e); } }
  async delete(req, res, next) { try { sendSuccess(res, await scheduleService.delete(req.params.id, req.user?.id)); } catch (e) { next(e); } }
  async assign(req, res, next) { try { sendSuccess(res, await scheduleService.assign(req.body, req.user?.id), 'Shifts assigned', 201); } catch (e) { next(e); } }
  async deleteAssignment(req, res, next) { try { sendSuccess(res, await scheduleService.deleteAssignment(req.params.id, req.user?.id)); } catch (e) { next(e); } }
  async getAssignments(req, res, next) { try { sendSuccess(res, await scheduleService.getAssignments(req.query)); } catch (e) { next(e); } }
  async getPermanentAssignments(req, res, next) { try { sendSuccess(res, await scheduleService.getPermanentAssignments(req.query)); } catch (e) { next(e); } }
  async removePermanentAssignment(req, res, next) { try { sendSuccess(res, await scheduleService.removePermanentAssignment(req.params.employeeId, req.user?.id)); } catch (e) { next(e); } }
}
module.exports = new ScheduleController();
