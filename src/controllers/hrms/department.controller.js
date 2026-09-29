const departmentService = require('../../services/hrms/department.service');
const { sendSuccess } = require('../../utils/response');

class DepartmentController {
  async getAll(req, res, next) { try { sendSuccess(res, await departmentService.getAll(req.query)); } catch (e) { next(e); } }
  async getById(req, res, next) { try { sendSuccess(res, await departmentService.getById(req.params.id)); } catch (e) { next(e); } }
  async create(req, res, next) { try { sendSuccess(res, await departmentService.create(req.body), 'Created', 201); } catch (e) { next(e); } }
  async update(req, res, next) { try { sendSuccess(res, await departmentService.update(req.params.id, req.body), 'Updated'); } catch (e) { next(e); } }
  async delete(req, res, next) { try { sendSuccess(res, await departmentService.delete(req.params.id)); } catch (e) { next(e); } }
}
module.exports = new DepartmentController();
