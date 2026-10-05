const shiftService = require('../services/shift.service');
const { sendSuccess } = require('../utils/response');

class ShiftController {
  async open(req, res, next) {
    try {
      const shift = await shiftService.openShift(req.user, { openingFloat: req.body?.openingFloat });
      return sendSuccess(res, shift, 'Shift opened', 201);
    } catch (error) {
      next(error);
    }
  }

  async close(req, res, next) {
    try {
      const shift = await shiftService.closeShift(req.user, req.body);
      return sendSuccess(res, shift, 'Shift closed');
    } catch (error) {
      next(error);
    }
  }

  async myOpen(req, res, next) {
    try {
      const shift = await shiftService.getMyOpenShift(req.user.id);
      return sendSuccess(res, shift);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const shift = await shiftService.getById(req.params.id, req.user);
      return sendSuccess(res, shift, 'Shift retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const { rows, meta } = await shiftService.list(req.query, req.user);
      return sendSuccess(res, { rows, meta }, 'Shifts retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async summary(req, res, next) {
    try {
      const summary = await shiftService.summaryForPeriod(req.user);
      return sendSuccess(res, summary, 'Shift summary retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ShiftController();
