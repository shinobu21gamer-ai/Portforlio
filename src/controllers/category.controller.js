const categoryService = require('../services/category.service');
const { sendSuccess } = require('../utils/response');

class CategoryController {
  async getAll(req, res, next) {
    try {
      const result = await categoryService.getAll(req.query);
      return sendSuccess(res, result, 'Categories retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getTree(req, res, next) {
    try {
      const categories = await categoryService.getTree();
      return sendSuccess(res, categories, 'Category tree retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const category = await categoryService.getById(req.params.id);
      return sendSuccess(res, category, 'Category retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const category = await categoryService.create(req.body);
      return sendSuccess(res, category, 'Category created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const category = await categoryService.update(req.params.id, req.body);
      return sendSuccess(res, category, 'Category updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await categoryService.delete(req.params.id);
      return sendSuccess(res, result, 'Category deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CategoryController();
