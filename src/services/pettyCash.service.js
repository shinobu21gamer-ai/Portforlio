const { Op } = require('sequelize');
const { PettyCashFund, PettyCashTransaction, User, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, getPaginationMeta, sanitizeObject } = require('../utils/helpers');

class PettyCashService {
  async getAllFunds() {
    const funds = await PettyCashFund.findAll({
      include: [{ association: 'creator', attributes: ['id', 'firstName', 'lastName'] }],
      order: [['createdAt', 'DESC']],
    });
    return { funds };
  }

  async getFundById(id) {
    const fund = await PettyCashFund.findByPk(id, {
      include: [{ association: 'creator', attributes: ['id', 'firstName', 'lastName'] }],
    });
    if (!fund) throw ApiError.notFound('Petty cash fund not found');
    return fund;
  }

  async createFund(data, userId) {
    const sanitized = sanitizeObject(data);
    const fund = await PettyCashFund.create({
      name: sanitized.name,
      description: sanitized.description || null,
      initialBalance: sanitized.initialBalance || 0,
      currentBalance: sanitized.initialBalance || 0,
      createdBy: userId,
    });
    return this.getFundById(fund.id);
  }

  async updateFund(id, data) {
    const fund = await PettyCashFund.findByPk(id);
    if (!fund) throw ApiError.notFound('Petty cash fund not found');
    if (fund.status === 'closed') throw ApiError.badRequest('Cannot edit a closed fund');
    const sanitized = sanitizeObject(data);
    await fund.update({
      name: sanitized.name || fund.name,
      description: sanitized.description !== undefined ? sanitized.description : fund.description,
    });
    return this.getFundById(id);
  }

  async closeFund(id) {
    const fund = await PettyCashFund.findByPk(id);
    if (!fund) throw ApiError.notFound('Petty cash fund not found');
    if (fund.status === 'closed') throw ApiError.badRequest('Fund already closed');
    await fund.update({ status: 'closed' });
    return this.getFundById(id);
  }

  async deposit(fundId, data, userId) {
    const fund = await PettyCashFund.findByPk(fundId);
    if (!fund) throw ApiError.notFound('Petty cash fund not found');
    if (fund.status === 'closed') throw ApiError.badRequest('Fund is closed');
    if (!data.amount || data.amount <= 0) throw ApiError.badRequest('Amount must be greater than 0');

    const t = await sequelize.transaction();
    try {
      const newBalance = parseFloat(fund.currentBalance) + parseFloat(data.amount);
      await fund.update({ currentBalance: newBalance }, { transaction: t });

      const transaction = await PettyCashTransaction.create({
        fundId: fund.id,
        type: 'deposit',
        amount: data.amount,
        balanceAfter: newBalance,
        description: data.description || 'Cash deposit',
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        userId,
      }, { transaction: t });

      await t.commit();
      return { fund: await this.getFundById(fundId), transaction };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async withdraw(fundId, data, userId) {
    const fund = await PettyCashFund.findByPk(fundId);
    if (!fund) throw ApiError.notFound('Petty cash fund not found');
    if (fund.status === 'closed') throw ApiError.badRequest('Fund is closed');
    if (!data.amount || data.amount <= 0) throw ApiError.badRequest('Amount must be greater than 0');
    if (parseFloat(data.amount) > parseFloat(fund.currentBalance)) {
      throw ApiError.badRequest('Insufficient fund balance');
    }

    const t = await sequelize.transaction();
    try {
      const newBalance = parseFloat(fund.currentBalance) - parseFloat(data.amount);
      await fund.update({ currentBalance: newBalance }, { transaction: t });

      const transaction = await PettyCashTransaction.create({
        fundId: fund.id,
        type: 'withdrawal',
        amount: data.amount,
        balanceAfter: newBalance,
        description: data.description || 'Cash withdrawal',
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        userId,
      }, { transaction: t });

      await t.commit();
      return { fund: await this.getFundById(fundId), transaction };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async getTransactions(fundId, query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = { fundId };
    if (query.type) where.type = query.type;

    const { rows, count } = await PettyCashTransaction.findAndCountAll({
      where,
      include: [{ association: 'user', attributes: ['id', 'firstName', 'lastName'] }],
      offset,
      limit,
      order: [['createdAt', 'DESC']],
    });

    return { transactions: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getSummary() {
    const funds = await PettyCashFund.findAll({ where: { status: 'active' } });
    const totalBalance = funds.reduce((sum, f) => sum + parseFloat(f.currentBalance), 0);
    return { totalBalance, fundCount: funds.length, funds };
  }
}

module.exports = new PettyCashService();
