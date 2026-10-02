const { Supplier, Purchase, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const ApiError = require('../utils/ApiError');
const { getPagination, getPaginationMeta, sanitizeObject, escapeLike } = require('../utils/helpers');

class SupplierService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};

    if (query.search) {
      const safeSearch = escapeLike(query.search);
      where[Op.or] = [
        { name: { [Op.like]: `%${safeSearch}%` } },
        { email: { [Op.like]: `%${safeSearch}%` } },
        { phone: { [Op.like]: `%${safeSearch}%` } },
        { contactPerson: { [Op.like]: `%${safeSearch}%` } },
      ];
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }
    if (query.category) {
      where.category = query.category;
    }

    const sortBy = ['name', 'createdAt', 'email', 'purchaseCount', 'rating', 'leadTimeDays', 'category'].includes(query.sortBy) ? query.sortBy : 'name';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const { rows, count } = await Supplier.findAndCountAll({
      where,
      attributes: {
        include: [
          [
            Supplier.sequelize.literal(`(
              SELECT COUNT(*)
              FROM purchases
              WHERE purchases.supplier_id = Supplier.id
                AND purchases.deleted_at IS NULL
            )`),
            'purchaseCount',
          ],
        ],
      },
      offset,
      limit,
      order: sortBy === 'purchaseCount'
        ? [[Supplier.sequelize.literal('purchaseCount'), sortOrder]]
        : [[sortBy, sortOrder]],
    });

    return { suppliers: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const supplier = await Supplier.findByPk(id, {
      include: [
        {
          association: 'purchases',
          limit: 10,
          order: [['orderDate', 'DESC']],
        },
      ],
    });
    if (!supplier) throw ApiError.notFound('Supplier not found');
    return { supplier };
  }

  async create(data) {
    const sanitized = sanitizeObject(data);
    const supplier = await Supplier.create(sanitized);
    return this.getById(supplier.id);
  }

  async update(id, data) {
    const supplier = await Supplier.findByPk(id);
    if (!supplier) throw ApiError.notFound('Supplier not found');
    const sanitized = sanitizeObject(data);
    await supplier.update(sanitized);
    return this.getById(id);
  }

  async delete(id) {
    const supplier = await Supplier.findByPk(id);
    if (!supplier) throw ApiError.notFound('Supplier not found');

    const activePurchases = await Purchase.count({
      where: {
        supplierId: id,
        status: { [Op.ne]: 'cancelled' },
      },
    });
    if (activePurchases > 0) {
      throw ApiError.badRequest('Cannot delete supplier with active purchases');
    }

    await supplier.destroy();
    return { message: 'Supplier deleted successfully' };
  }

  async getOutstandingBalances(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);

    const { rows, count } = await Supplier.findAndCountAll({
      include: [
        {
          association: 'purchases',
          where: { paymentStatus: { [Op.ne]: 'paid' }, status: { [Op.ne]: 'cancelled' } },
          required: true,
          attributes: ['id', 'orderNo', 'total', 'paidAmount', 'paymentStatus', 'orderDate'],
        },
      ],
      distinct: true,
      offset,
      limit,
      order: [['name', 'ASC']],
    });

    const suppliers = rows.map((supplier) => {
      const data = supplier.toJSON();
      data.outstandingBalance = data.purchases.reduce((sum, p) => {
        return sum + Math.max(0, parseFloat(p.total) - parseFloat(p.paidAmount));
      }, 0);
      return data;
    });

    return { suppliers, pagination: getPaginationMeta(count, page, limit) };
  }

  async getSupplierSummary(id) {
    const supplier = await Supplier.findByPk(id);
    if (!supplier) throw ApiError.notFound('Supplier not found');

    const result = await Purchase.findOne({
      where: { supplierId: id, status: { [Op.ne]: 'cancelled' } },
      attributes: [
        [fn('COUNT', col('id')), 'purchaseCount'],
        [fn('SUM', col('total')), 'totalSpend'],
        [fn('AVG', col('total')), 'avgOrderValue'],
        [fn('MAX', col('order_date')), 'lastPurchaseDate'],
      ],
      raw: true,
    });

    const outstanding = await Purchase.findAll({
      where: { supplierId: id, paymentStatus: { [Op.ne]: 'paid' }, status: { [Op.ne]: 'cancelled' } },
      attributes: [
        [fn('SUM', literal('total - paid_amount')), 'outstandingBalance'],
      ],
      raw: true,
    });

    return {
      supplierId: id,
      name: supplier.name,
      purchaseCount: parseInt(result.purchaseCount) || 0,
      totalSpend: parseFloat(result.totalSpend) || 0,
      avgOrderValue: parseFloat(result.avgOrderValue) || 0,
      lastPurchaseDate: result.lastPurchaseDate || null,
      outstandingBalance: Math.max(0, parseFloat(outstanding[0]?.outstandingBalance) || 0),
    };
  }

  async getSupplierPurchases(id, query) {
    const supplier = await Supplier.findByPk(id);
    if (!supplier) throw ApiError.notFound('Supplier not found');

    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = { supplierId: id };

    if (query.status) where.status = query.status;

    const { rows, count } = await Purchase.findAndCountAll({
      where,
      include: [
        { association: 'items', attributes: ['id', 'productName', 'quantity', 'unitCost', 'total'] },
      ],
      offset,
      limit,
      order: [['orderDate', 'DESC']],
    });

    return { purchases: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async exportAll() {
    const suppliers = await Supplier.findAll({
      order: [['name', 'ASC']],
      raw: true,
    });
    return suppliers;
  }

  async importFromCsv(rows) {
    const results = { created: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.name || row.name.trim().length < 2) {
          results.errors.push({ row: i + 1, error: 'Name is required (min 2 chars)' });
          continue;
        }
        const lat = row.latitude !== '' && row.latitude != null ? parseFloat(row.latitude) : NaN;
        const lng = row.longitude !== '' && row.longitude != null ? parseFloat(row.longitude) : NaN;
        const sanitized = sanitizeObject({
          name: row.name,
          contactPerson: row.contactPerson || '',
          email: row.email || '',
          phone: row.phone || '',
          mobile: row.mobile || '',
          address: row.address || '',
          city: row.city || '',
          province: row.province || '',
          postalCode: row.postalCode || '',
          taxId: row.taxId || '',
          paymentTerms: row.paymentTerms || '',
          notes: row.notes || '',
          website: row.website || '',
          category: row.category || 'other',
          leadTimeDays: row.leadTimeDays ? parseInt(row.leadTimeDays) : null,
          minimumOrderAmount: row.minimumOrderAmount ? parseFloat(row.minimumOrderAmount) : null,
          rating: row.rating ? parseFloat(row.rating) : null,
          bankName: row.bankName || '',
          bankAccount: row.bankAccount || '',
          registrationNumber: row.registrationNumber || '',
          latitude: Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : null,
          longitude: Number.isFinite(lng) && lng >= -180 && lng <= 180 ? lng : null,
        });
        await Supplier.create(sanitized);
        results.created++;
      } catch (err) {
        results.errors.push({ row: i + 1, error: err.message });
      }
    }

    return results;
  }

  async getAnalytics() {
    const totalSuppliers = await Supplier.count();
    const activeSuppliers = await Supplier.count({ where: { isActive: true } });

    const topByPurchases = await Supplier.findAll({
      attributes: {
        include: [
          [
            literal(`(
              SELECT COUNT(*)
              FROM purchases
              WHERE purchases.supplier_id = Supplier.id
                AND purchases.deleted_at IS NULL
            )`),
            'purchaseCount',
          ],
          [
            literal(`(
              SELECT COALESCE(SUM(total), 0)
              FROM purchases
              WHERE purchases.supplier_id = Supplier.id
                AND purchases.deleted_at IS NULL
            )`),
            'totalSpend',
          ],
        ],
      },
      order: [[literal('totalSpend'), 'DESC']],
      limit: 10,
      raw: true,
    });

    const categoryBreakdown = await Supplier.findAll({
      attributes: ['category', [fn('COUNT', col('id')), 'count']],
      group: ['category'],
      raw: true,
    });

    const avgRating = await Supplier.findOne({
      attributes: [[fn('AVG', col('rating')), 'avgRating']],
      where: { rating: { [Op.ne]: null } },
      raw: true,
    });

    return {
      totalSuppliers,
      activeSuppliers,
      inactiveSuppliers: totalSuppliers - activeSuppliers,
      topByPurchases,
      categoryBreakdown,
      avgRating: parseFloat(avgRating?.avgRating) || 0,
    };
  }
}

module.exports = new SupplierService();
