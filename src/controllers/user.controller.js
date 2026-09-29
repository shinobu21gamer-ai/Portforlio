const userService = require('../services/user.service');
const { sendSuccess, sendPaginated } = require('../utils/response');
const ApiError = require('../utils/ApiError');

const getAll = async (req, res, next) => {
  try {
    const result = await userService.getAll(req.query);
    sendPaginated(res, result);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const user = await userService.getById(req.params.id);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const user = await userService.create(req.body);
    sendSuccess(res, user, 'User created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const user = await userService.update(req.params.id, req.body);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

const delete_ = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      throw ApiError.forbidden('Cannot delete your own account');
    }
    const targetUser = await userService.getById(req.params.id);
    if (targetUser.role?.slug === 'admin') {
      throw ApiError.forbidden('Cannot delete admin users');
    }
    await userService.delete(req.params.id);
    sendSuccess(res, null, 'User deleted successfully', 204);
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, delete: delete_ };
