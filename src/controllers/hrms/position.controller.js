const positionService = require('../../services/hrms/position.service');
const { sendSuccess } = require('../../utils/response');

class PositionController {
  async getAll(req, res, next) { try { sendSuccess(res, await positionService.getAll(req.query)); } catch (e) { next(e); } }
  async getById(req, res, next) { try { sendSuccess(res, await positionService.getById(req.params.id)); } catch (e) { next(e); } }
  async create(req, res, next) { try { sendSuccess(res, await positionService.create(req.body), 'Created', 201); } catch (e) { next(e); } }
  async update(req, res, next) { try { sendSuccess(res, await positionService.update(req.params.id, req.body), 'Updated'); } catch (e) { next(e); } }
  async delete(req, res, next) { try { sendSuccess(res, await positionService.delete(req.params.id)); } catch (e) { next(e); } }
}
module.exports = new PositionController();
