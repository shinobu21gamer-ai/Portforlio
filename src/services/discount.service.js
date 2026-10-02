const { Discount } = require('../models');
const { Op } = require('sequelize');
const ApiError = require('../utils/ApiError');
const { getPagination, getPaginationMeta, sanitizeObject, escapeLike } = require('../utils/helpers');

class DiscountService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};

    if (query.search) {
      const safeSearch = escapeLike(query.search);
      where[Op.or] = [
        { code: { [Op.like]: `%${safeSearch}%` } },
        { name: { [Op.like]: `%${safeSearch}%` } },
      ];
    }
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.type) where.type = query.type;

    const sortBy = ['code', 'name', 'value', 'usedCount', 'createdAt', 'endDate'].includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const { rows, count } = await Discount.findAndCountAll({
      where,
      offset,
      limit,
      order: [[sortBy, sortOrder]],
    });

    return { discounts: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const discount = await Discount.findByPk(id);
    if (!discount) throw ApiError.notFound('Discount not found');
    return { discount };
  }

  async getByCode(code) {
    const discount = await Discount.findOne({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        [Op.and]: [
          { [Op.or]: [{ startDate: null }, { startDate: { [Op.lte]: new Date() } }] },
          { [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: new Date() } }] },
        ],
      },
    });
    if (!discount) throw ApiError.notFound('Discount code not found or expired');
    if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
      throw ApiError.badRequest('Promo code has reached its usage limit');
    }
    return { discount };
  }

  async validateAndApply(code, subtotal, appliedDiscounts = []) {
    const { discount } = await this.getByCode(code);

    if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
      throw ApiError.badRequest('Discount usage limit reached');
    }

    if (discount.minPurchaseAmount && parseFloat(subtotal) < parseFloat(discount.minPurchaseAmount)) {
      throw ApiError.badRequest(`Minimum purchase amount of ₱${discount.minPurchaseAmount} required`);
    }

    // Validate discount stacking rules
    const allDiscounts = [...appliedDiscounts, discount];
    const validation = this._validateDiscountStacking(allDiscounts);
    if (!validation.valid) {
      throw ApiError.badRequest(validation.error);
    }

    let discountAmount;
    if (discount.type === 'percentage') {
      discountAmount = parseFloat(((parseFloat(subtotal) * parseFloat(discount.value)) / 100).toFixed(2));
    } else {
      discountAmount = Math.min(parseFloat(discount.value), parseFloat(subtotal));
    }

    if (discount.maxDiscountAmount && discountAmount > parseFloat(discount.maxDiscountAmount)) {
      discountAmount = parseFloat(discount.maxDiscountAmount);
    }

    return {
      discount: {
        id: discount.id,
        code: discount.code,
        name: discount.name,
        type: discount.type,
        value: parseFloat(discount.value),
      },
      discountAmount,
    };
  }

  _validateDiscountStacking(discounts) {
    const types = discounts.map(d => d.type);

    if (types.includes('senior') && types.length > 1) {
      return { valid: false, error: 'Senior discount is exclusive and cannot be combined with other discounts' };
    }
    if (types.includes('bxgy') && types.length > 1) {
      return { valid: false, error: 'BXGY discount cannot be combined with other discounts' };
    }
    if (types.filter(t => t === 'percentage').length > 1) {
      return { valid: false, error: 'Cannot stack multiple percentage discounts' };
    }
    if (types.filter(t => t === 'fixed').length > 1) {
      return { valid: false, error: 'Cannot stack multiple fixed discounts' };
    }

    return { valid: true };
  }

  async create(data) {
    const sanitized = sanitizeObject(data);
    if (sanitized.code) sanitized.code = sanitized.code.toUpperCase();

    const existing = await Discount.findOne({ where: { code: sanitized.code } });
    if (existing) throw ApiError.conflict('Discount code already exists');

    if (sanitized.type === 'percentage' && parseFloat(sanitized.value) > 100) {
      throw ApiError.badRequest('Percentage discount cannot exceed 100%');
    }

    const discount = await Discount.create(sanitized);
    return { discount };
  }

  async update(id, data) {
    const discount = await Discount.findByPk(id);
    if (!discount) throw ApiError.notFound('Discount not found');

    const sanitized = sanitizeObject(data);
    if (sanitized.code) sanitized.code = sanitized.code.toUpperCase();

    if (sanitized.code && sanitized.code !== discount.code) {
      const existing = await Discount.findOne({ where: { code: sanitized.code } });
      if (existing) throw ApiError.conflict('Discount code already exists');
    }

    // The check must consider the type the record will end up with, not just
    // the type in this payload. A partial update of only `value` on an existing
    // percentage discount would otherwise bypass the ceiling entirely.
    const effectiveType = sanitized.type || discount.type;
    if (effectiveType === 'percentage' && sanitized.value && parseFloat(sanitized.value) > 100) {
      throw ApiError.badRequest('Percentage discount cannot exceed 100%');
    }

    await discount.update(sanitized);
    return { discount };
  }

  async delete(id) {
    const discount = await Discount.findByPk(id);
    if (!discount) throw ApiError.notFound('Discount not found');
    await discount.destroy();
    return { message: 'Discount deleted successfully' };
  }

  async incrementUsage(id, transaction) {
    const opts = transaction ? { transaction } : {};
    const discount = await Discount.findByPk(id, opts);
    if (!discount) throw ApiError.notFound('Discount not found');
    await discount.increment('usedCount', opts);
    // increment() updates the row but leaves this instance holding the
    // pre-increment value, so callers that check the usage limit right after
    // would see a stale usedCount. reload() to return the committed value.
    await discount.reload(opts);
    return { discount };
  }
}

module.exports = new DiscountService();
