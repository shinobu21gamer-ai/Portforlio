const { Op, fn, col } = require('sequelize');
const { Shift, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../utils/helpers');

/**
 * Register shifts (Phase 4).
 *
 * Cash accountability: cash sales completed by a user are attributed to
 * their open shift (if any) at the moment they happen; cash refunds voided
 * during the shift reduce the expected cash. When the shift is closed, the
 * operator counts the till and the difference vs. expected is recorded.
 *
 * Attribution is best-effort: sales made while the cashier has no open
 * shift are not attributed (the shift was never opened, so there is no
 * register to account for).
 */
class ShiftService {
  async openShift(user, { openingFloat }) {
    const t = await sequelize.transaction();
    try {
      const existing = await Shift.findOne({
        where: { userId: user.id, status: 'open' },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (existing) {
        throw ApiError.conflict('You already have an open shift — close it before opening a new one');
      }
      const shift = await Shift.create({
        userId: user.id,
        status: 'open',
        openedAt: new Date(),
        openingFloat: Math.max(0, parseFloat(openingFloat) || 0),
      }, { transaction: t });
      await t.commit();
      return this.getById(shift.id, user);
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }

  async closeShift(user, { countedCash, notes }) {
    const counted = countedCash === undefined || countedCash === null || countedCash === ''
      ? NaN
      : parseFloat(countedCash);
    if (Number.isNaN(counted) || counted < 0) {
      throw ApiError.badRequest('Counted cash is required and must be >= 0');
    }

    const t = await sequelize.transaction();
    try {
      const shift = await Shift.findOne({
        where: { userId: user.id, status: 'open' },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!shift) throw ApiError.badRequest('You have no open shift to close');

      const openingFloat = parseFloat(shift.openingFloat) || 0;
      const cashSalesTotal = parseFloat(shift.cashSalesTotal) || 0;
      const voidedTotal = parseFloat(shift.voidedTotal) || 0;
      const expectedCash = Math.round((openingFloat + cashSalesTotal - voidedTotal) * 100) / 100;
      const cashDifference = Math.round((counted - expectedCash) * 100) / 100;

      await shift.update({
        status: 'closed',
        closedAt: new Date(),
        countedCash: counted,
        expectedCash,
        cashDifference,
        notes: notes || shift.notes || null,
      }, { transaction: t });
      await t.commit();
      return this.getById(shift.id, user);
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }

  /**
   * Attribute a cash movement to the user's open shift (called INSIDE the
   * sale/refund transactions):
   *   delta > 0 → cash sale completed (cashSalesTotal += delta)
   *   delta < 0 → cash refund voided   (voidedTotal += |delta|)
   * No-op when the user has no open shift.
   */
  async adjustOpenShift(userId, delta, transaction = null) {
    if (!userId || !delta) return;
    const t = transaction || await sequelize.transaction();
    try {
      const shift = await Shift.findOne({
        where: { userId, status: 'open' },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!shift) { if (!transaction) await t.rollback(); return; }

      if (delta > 0) {
        await shift.increment('cashSalesTotal', { by: delta, transaction: t });
      } else {
        // Never let voids drive the counter below zero (shift opened mid-day).
        const floorAt = Math.max(0, -(parseFloat(shift.voidedTotal) || 0) + (parseFloat(shift.cashSalesTotal) || 0));
        const applied = Math.min(Math.abs(delta), floorAt);
        if (applied > 0) await shift.increment('voidedTotal', { by: applied, transaction: t });
      }
      if (!transaction) await t.commit();
    } catch (e) {
      if (!transaction) await t.rollback();
      throw e;
    }
  }

  async getMyOpenShift(userId) {
    return Shift.findOne({
      where: { userId, status: 'open' },
      include: [{ association: 'user', attributes: ['id', 'firstName', 'lastName'] }],
    });
  }

  async getById(id, user) {
    const shift = await Shift.findByPk(id, {
      include: [{ association: 'user', attributes: ['id', 'firstName', 'lastName'] }],
    });
    if (!shift) throw ApiError.notFound('Shift not found');
    if (user && user.role?.slug === 'cashier' && String(shift.userId) !== String(user.id)) {
      throw ApiError.forbidden('You do not have access to this shift');
    }
    return shift;
  }

  async list(query, user) {
    // getPagination(page, limit) — passing the whole query object made `page`
    // unparseable (always page 1) and the `pageSize` destructure below left
    // `limit` undefined, so the endpoint ignored pagination entirely.
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    const isPrivileged = ['admin', 'manager'].includes(user?.role?.slug);

    if (!isPrivileged) {
      // Staff see their own shifts only.
      where.userId = user.id;
    } else if (query.userId) {
      where.userId = query.userId;
    }
    if (query.status === 'open' || query.status === 'closed') where.status = query.status;
    if (query.from || query.to) {
      where.openedAt = {};
      if (query.from) where.openedAt[Op.gte] = new Date(`${query.from}T00:00:00`);
      if (query.to) where.openedAt[Op.lte] = new Date(`${query.to}T23:59:59`);
    }

    const { rows, count } = await Shift.findAndCountAll({
      where,
      include: [{ association: 'user', attributes: ['id', 'firstName', 'lastName'] }],
      order: [['openedAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset,
    });
    return { rows, meta: getPaginationMeta(count, page, limit) };
  }

  async summaryForPeriod(user) {
    // Admin/manager rollup of closed shifts (for the manager dashboard).
    const isPrivileged = ['admin', 'manager'].includes(user?.role?.slug);
    const where = { status: 'closed' };
    if (!isPrivileged) where.userId = user.id;
    // The Shift model maps its attributes onto snake_case columns
    // (`underscored: true` + explicit `field:`), so `col()` — which is raw SQL —
    // must use the *column* names, not the camelCase attribute names. Using
    // attribute names made this aggregate reference unknown columns and blow up
    // with a 500 on every call.
    const rows = await Shift.findAll({
      where,
      attributes: [
        [fn('COUNT', col('id')), 'closedShifts'],
        [fn('COALESCE', fn('SUM', col('cash_sales_total')), 0), 'cashSales'],
        [fn('COALESCE', fn('SUM', col('voided_total')), 0), 'voided'],
        [fn('COALESCE', fn('SUM', col('cash_difference')), 0), 'difference'],
      ],
      raw: true,
    });
    const row = rows[0] || {};
    return {
      closedShifts: Number(row.closedShifts || 0),
      cashSales: Number(row.cashSales || 0),
      voided: Number(row.voided || 0),
      difference: Number(row.difference || 0),
    };
  }
}

module.exports = new ShiftService();
