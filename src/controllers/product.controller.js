const productService = require('../services/product.service');
const { sendSuccess, sendPaginated } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const getAll = async (req, res, next) => {
  try {
    const result = await productService.getAll(req.query);
    sendPaginated(res, result);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const product = await productService.getById(req.params.id);
    sendSuccess(res, product);
  } catch (error) {
    next(error);
  }
};

const getByBarcode = async (req, res, next) => {
  try {
    const product = await productService.getByBarcode(req.params.barcode);
    sendSuccess(res, product);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    if (req.file) {
      req.body.image = `/uploads/products/${req.file.filename}`;
    }
    const product = await productService.create(req.body);
    sendSuccess(res, product, 'Product created successfully', 201);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    if (req.file) {
      const existing = await productService.getById(req.params.id);
      if (existing?.product?.image) {
        const imgPath = path.join(config.upload.path, existing.product.image.replace(/^\/uploads\//, ''));
        if (fs.existsSync(imgPath)) {
          try { fs.unlinkSync(imgPath); } catch (e) { /* ignore */ }
        }
      }
      req.body.image = `/uploads/products/${req.file.filename}`;
    }
    req.body.updatedBy = req.user.id;
    const product = await productService.update(req.params.id, req.body);
    sendSuccess(res, product, 'Product updated successfully');
  } catch (error) {
    next(error);
  }
};

const del = async (req, res, next) => {
  try {
    const existing = await productService.getById(req.params.id);
    if (existing?.product?.image) {
      const imgPath = path.join(config.upload.path, existing.product.image.replace(/^\/uploads\//, ''));
      if (fs.existsSync(imgPath)) {
        try { fs.unlinkSync(imgPath); } catch (e) { /* ignore */ }
      }
    }
    await productService.delete(req.params.id);
    sendSuccess(res, null, 'Product deleted successfully', 204);
  } catch (error) {
    next(error);
  }
};

const getLowStock = async (req, res, next) => {
  try {
    const result = await productService.getLowStock(req.query);
    sendPaginated(res, result);
  } catch (error) {
    next(error);
  }
};

const getExpiring = async (req, res, next) => {
  try {
    const products = await productService.getExpiring(req.query.days);
    sendSuccess(res, products);
  } catch (error) {
    next(error);
  }
};

const getBestSellers = async (req, res, next) => {
  try {
    const products = await productService.getBestSellers(
      req.query.limit,
      req.query.startDate,
      req.query.endDate
    );
    sendSuccess(res, products);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  getByBarcode,
  create,
  update,
  delete: del,
  getLowStock,
  getExpiring,
  getBestSellers,
};
