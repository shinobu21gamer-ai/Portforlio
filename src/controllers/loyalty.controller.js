const customerService = require('../services/customer.service');
const { LoyaltyPoint, Customer } = require('../models');
const { sendSuccess } = require('../utils/response');
const ApiError = require('../utils/ApiError');

class LoyaltyController {
  async getHistory(req, res, next) {
    try {
      const { customerId } = req.params;
      const customer = await Customer.findByPk(customerId);
      if (!customer) throw ApiError.notFound('Customer not found');

      const logs = await LoyaltyPoint.findAll({
        where: { customerId },
        include: [{ model: require('../models').Sale, as: 'sale', attributes: ['id', 'invoiceNo', 'total'] }],
        order: [['createdAt', 'DESC']],
      });

      sendSuccess(res, { customer: { id: customer.id, loyaltyPoints: customer.loyaltyPoints }, logs });
    } catch (err) { next(err); }
  }

  async redeem(req, res, next) {
    try {
      const { customerId, points, notes } = req.body;
      if (!customerId || !points) throw ApiError.badRequest('customerId and points are required');
      if (points <= 0) throw ApiError.badRequest('Points must be positive');

      const updated = await customerService.redeemLoyaltyPoints(customerId, points);
      sendSuccess(res, updated, 'Loyalty points redeemed');
    } catch (err) { next(err); }
  }
}

module.exports = new LoyaltyController();
