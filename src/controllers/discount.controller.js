const discountService = require('../services/discount.service');
const { sendSuccess, sendPaginated } = require('../utils/response');

const getAll = async (req, res, next) => {
  try {
    const result = await discountService.getAll(req.query);
    sendPaginated(res, result);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const result = await discountService.getById(req.params.id);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

const validate = async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;
    const result = await discountService.validateAndApply(code, subtotal);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await discountService.create(req.body);
    sendSuccess(res, result, 'Discount created successfully', 201);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await discountService.update(req.params.id, req.body);
    sendSuccess(res, result, 'Discount updated successfully');
  } catch (error) {
    next(error);
  }
};

const del = async (req, res, next) => {
  try {
    await discountService.delete(req.params.id);
    sendSuccess(res, null, 'Discount deleted successfully', 204);
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getById, validate, create, update, delete: del };
