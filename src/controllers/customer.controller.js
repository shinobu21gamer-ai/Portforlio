const customerService = require('../services/customer.service');
const { sendSuccess } = require('../utils/response');

class CustomerController {
  async getAll(req, res, next) {
    try {
      const result = await customerService.getAll(req.query);
      return sendSuccess(res, result, 'Customers retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const customer = await customerService.getById(req.params.id);
      return sendSuccess(res, customer, 'Customer retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const customer = await customerService.create(req.body);
      return sendSuccess(res, customer, 'Customer created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const customer = await customerService.update(req.params.id, req.body);
      return sendSuccess(res, customer, 'Customer updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await customerService.delete(req.params.id);
      return sendSuccess(res, result, 'Customer deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CustomerController();
