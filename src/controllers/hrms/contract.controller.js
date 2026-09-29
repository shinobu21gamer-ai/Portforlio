const contractService = require('../../services/hrms/contract.service');
const { sendSuccess } = require('../../utils/response');

class ContractController {
  async getAll(req, res, next) { try { sendSuccess(res, await contractService.getAll(req.query)); } catch (e) { next(e); } }
  async getById(req, res, next) { try { sendSuccess(res, await contractService.getById(req.params.id)); } catch (e) { next(e); } }
  async create(req, res, next) { try { sendSuccess(res, await contractService.create(req.body), 'Created', 201); } catch (e) { next(e); } }
  async update(req, res, next) { try { sendSuccess(res, await contractService.update(req.params.id, req.body)); } catch (e) { next(e); } }
  async approve(req, res, next) { try { sendSuccess(res, await contractService.approve(req.params.id, req.user.id)); } catch (e) { next(e); } }
  async reject(req, res, next) { try { sendSuccess(res, await contractService.reject(req.params.id, req.body.remarks, req.user.id)); } catch (e) { next(e); } }
  async terminate(req, res, next) { try { sendSuccess(res, await contractService.terminate(req.params.id, req.user.id)); } catch (e) { next(e); } }
  async delete(req, res, next) { try { sendSuccess(res, await contractService.delete(req.params.id)); } catch (e) { next(e); } }
  async getExpiring(req, res, next) { try { sendSuccess(res, await contractService.getExpiring(req.query.days)); } catch (e) { next(e); } }
  async renew(req, res, next) { try { sendSuccess(res, await contractService.renew(req.params.id, req.body, req.user.id), 'Contract renewed', 201); } catch (e) { next(e); } }
  async checkExpired(req, res, next) { try { sendSuccess(res, await contractService.checkExpired()); } catch (e) { next(e); } }
}

module.exports = new ContractController();
