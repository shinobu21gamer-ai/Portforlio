const { Category, Product, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const { slugify, getPagination, getPaginationMeta, sanitizeObject, escapeLike } = require('../utils/helpers');

class CategoryService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};

    if (query.search) {
      where.name = { [require('sequelize').Op.like]: `%${escapeLike(query.search)}%` };
    }
    if (query.parentId !== undefined) {
      where.parentId = query.parentId === 'null' ? null : query.parentId;
    }
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const { rows, count } = await Category.findAndCountAll({
      where,
      include: [{ association: 'parent', attributes: ['id', 'name'] }],
      offset,
      limit,
      order: [['name', 'ASC']],
    });

    return { categories: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getTree() {
    const categories = await Category.findAll({
      where: { parentId: null },
      include: [{ association: 'children', where: { isActive: true }, required: false }],
      order: [['name', 'ASC']],
    });
    return categories;
  }

  async getById(id) {
    const category = await Category.findByPk(id, {
      include: [
        { association: 'parent', attributes: ['id', 'name'] },
        { association: 'children', attributes: ['id', 'name'] },
      ],
    });
    if (!category) throw ApiError.notFound('Category not found');
    return category;
  }

  async create(data) {
    const sanitized = sanitizeObject(data);
    const slug = slugify(sanitized.name);

    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const existing = await Category.findOne({ where: { slug }, transaction: t, lock: t.LOCK.UPDATE });
      if (existing) throw ApiError.conflict('Category with this name already exists');

      if (sanitized.parentId) {
        const parent = await Category.findByPk(sanitized.parentId, { transaction: t });
        if (!parent) throw ApiError.notFound('Parent category not found');
      }

      const category = await Category.create({ ...sanitized, slug }, { transaction: t });
      await t.commit();
      return category;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async update(id, data) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const category = await Category.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!category) throw ApiError.notFound('Category not found');

      const sanitized = sanitizeObject(data);

      if (sanitized.name && sanitized.name !== category.name) {
        sanitized.slug = slugify(sanitized.name);
        const existing = await Category.findOne({ where: { slug: sanitized.slug, id: { [require('sequelize').Op.ne]: id } }, transaction: t });
        if (existing) throw ApiError.conflict('Category with this name already exists');
      }

      if (sanitized.parentId) {
        if (sanitized.parentId === id) throw ApiError.badRequest('Category cannot be its own parent');
        const parent = await Category.findByPk(sanitized.parentId, { transaction: t });
        if (!parent) throw ApiError.notFound('Parent category not found');
      }

      await category.update(sanitized, { transaction: t });
      await t.commit();
      return this.getById(id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async delete(id) {
    const category = await Category.findByPk(id);
    if (!category) throw ApiError.notFound('Category not found');

    const hasChildren = await Category.findOne({ where: { parentId: id } });
    if (hasChildren) throw ApiError.badRequest('Cannot delete category with subcategories');

    const hasProducts = await Product.findOne({ where: { categoryId: id } });
    if (hasProducts) throw ApiError.badRequest('Cannot delete category that has products assigned');

    await category.destroy();
    return { message: 'Category deleted successfully' };
  }
}

module.exports = new CategoryService();
