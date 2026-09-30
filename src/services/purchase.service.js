const { Op } = require('sequelize');
const {
  Purchase, PurchaseItem, Product, Supplier, StockMovement, Notification, PettyCashFund, PettyCashTransaction, sequelize,
} = require('../models');
const ApiError = require('../utils/ApiError');
const {
  generateOrderNo, calculateTax, getPagination, getPaginationMeta, escapeLike,
} = require('../utils/helpers');
const config = require('../config');

class PurchaseService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};

    if (query.search) {
      const safeSearch = escapeLike(query.search);
      const { rows: supplierRows } = await Supplier.findAndCountAll({
        where: { name: { [Op.like]: `%${safeSearch}%` } },
        attributes: ['id'],
      });
      const supplierIds = supplierRows.map(s => s.id);
      const orConditions = [
        { orderNo: { [Op.like]: `%${safeSearch}%` } },
      ];
      if (supplierIds.length > 0) {
        orConditions.push({ supplierId: { [Op.in]: supplierIds } });
      }
      where[Op.or] = orConditions;
    }
    if (query.status) where.status = query.status;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.userId) where.userId = query.userId;
    if (query.startDate && query.endDate) {
      where.orderDate = { [Op.between]: [query.startDate, query.endDate] };
    } else if (query.startDate) {
      where.orderDate = { [Op.gte]: query.startDate };
    } else if (query.endDate) {
      where.orderDate = { [Op.lte]: query.endDate };
    }

    const sortBy = ['createdAt', 'orderNo', 'total', 'status', 'orderDate'].includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const { rows, count } = await Purchase.findAndCountAll({
      where,
      include: [
        { association: 'supplier', attributes: ['id', 'name'] },
        { association: 'user', attributes: ['id', 'firstName', 'lastName'] },
      ],
      offset,
      limit,
      order: [[sortBy, sortOrder]],
    });

    return { purchases: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const purchase = await Purchase.findByPk(id, {
      include: [
        { association: 'items', include: [{ association: 'product', attributes: ['id', 'name', 'sku', 'image'] }] },
        { association: 'supplier' },
        { association: 'user', attributes: ['id', 'firstName', 'lastName'] },
      ],
    });
    if (!purchase) throw ApiError.notFound('Purchase not found');
    return purchase;
  }

  async create(data, userId) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });

    try {
      const orderNo = generateOrderNo('PO');

      let subtotal = 0;
      const items = [];

      for (const item of data.items) {
        const product = await Product.findOne({
          where: { id: item.productId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!product) throw ApiError.notFound(`Product #${item.productId} not found`);

        const unitCost = parseFloat(item.unitCost);
        const itemSubtotal = unitCost * item.quantity;
        const discount = parseFloat(item.discount || 0);
        const itemTax = calculateTax(itemSubtotal - discount, parseFloat(item.taxRate || 0));
        const itemTotal = itemSubtotal - discount + itemTax;
        subtotal += itemSubtotal;

        items.push({
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          quantity: item.quantity,
          receivedQuantity: 0,
          unitCost,
          discount,
          taxRate: item.taxRate || 0,
          taxAmount: itemTax,
          subtotal: itemSubtotal,
          total: itemTotal,
          expiryDate: item.expiryDate || null,
        });
      }

      const totalDiscount = parseFloat(data.discount || 0);
      const totalTax = calculateTax(subtotal - totalDiscount, config.app.taxRate);
      const total = subtotal - totalDiscount + totalTax + parseFloat(data.shippingFee || 0);

      const purchase = await Purchase.create({
        orderNo,
        userId,
        supplierId: data.supplierId,
        orderDate: data.orderDate || new Date(),
        expectedDate: data.expectedDate || null,
        status: 'ordered',
        paymentStatus: 'pending',
        subtotal,
        discount: totalDiscount,
        tax: totalTax,
        shippingFee: parseFloat(data.shippingFee || 0),
        total,
        paidAmount: 0,
        notes: data.notes || null,
      }, { transaction: t });

      for (const item of items) {
        await PurchaseItem.create({ ...item, purchaseId: purchase.id }, { transaction: t });
      }

      await Notification.create({
        type: 'new_purchase',
        title: `New Purchase Order #${orderNo}`,
        message: `Purchase order created for total of ${total} ${config.app.currency}`,
        data: { purchaseId: purchase.id, orderNo, total },
      }, { transaction: t });

      await t.commit();
      return this.getById(purchase.id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async receive(id, data, userId) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const purchase = await Purchase.findByPk(id, { include: [{ association: 'items' }], transaction: t, lock: t.LOCK.UPDATE });
      if (!purchase) throw ApiError.notFound('Purchase not found');
      if (purchase.status === 'received') throw ApiError.badRequest('Purchase already received');
      if (purchase.status === 'cancelled') throw ApiError.badRequest('Purchase is cancelled');

      let allReceived = true;

      for (const item of purchase.items) {
        const recvItem = data.items && data.items.find((d) => d.purchaseItemId === item.id);
        const recvQty = recvItem ? recvItem.quantity : item.quantity;

        if (recvQty < 0 || recvQty > item.quantity) {
          throw ApiError.badRequest(`Invalid received quantity for ${item.productName}. Max: ${item.quantity}`);
        }

        const product = await Product.findOne({
          where: { id: item.productId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (product && recvQty > 0) {
          const previousStock = product.stockQuantity;
          const newStock = previousStock + recvQty;

          await product.update({ stockQuantity: newStock }, { transaction: t });

          await StockMovement.create({
            productId: item.productId,
            userId,
            type: 'in',
            quantity: recvQty,
            previousStock,
            newStock,
            referenceType: 'Purchase',
            referenceId: purchase.id,
            notes: `Received ${recvQty} of ${item.productName} from PO #${purchase.orderNo}`,
          }, { transaction: t });

          if (item.expiryDate) {
            const newExp = new Date(item.expiryDate);
            const currentExp = product.expiryDate ? new Date(product.expiryDate) : null;
            if (!currentExp || newExp > currentExp) {
              await product.update({ expiryDate: item.expiryDate }, { transaction: t });
            }
          }
        }

        await PurchaseItem.update(
          { receivedQuantity: recvQty },
          { where: { id: item.id }, transaction: t }
        );

        if (recvQty < item.quantity) allReceived = false;
      }

      const paidAmount = parseFloat(data.paidAmount || 0);
      const newTotalPaid = parseFloat(purchase.paidAmount || 0) + paidAmount;
      let newPaymentStatus = purchase.paymentStatus;
      if (allReceived && newTotalPaid >= parseFloat(purchase.total)) {
        newPaymentStatus = 'paid';
      } else if (newTotalPaid > 0) {
        newPaymentStatus = 'partial';
      }

      await purchase.update({
        status: allReceived ? 'received' : 'partial',
        paidAmount: newTotalPaid,
        paymentStatus: newPaymentStatus,
      }, { transaction: t });

      await Notification.create({
        type: 'new_purchase',
        title: `Purchase ${allReceived ? 'Received' : 'Partially Received'} #${purchase.orderNo}`,
        message: `Purchase order #${purchase.orderNo} ${allReceived ? 'fully' : 'partially'} received and inventory updated.`,
        data: { purchaseId: purchase.id, orderNo: purchase.orderNo },
      }, { transaction: t });

      await t.commit();
      return this.getById(id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async cancel(id) {
    const purchase = await Purchase.findByPk(id);
    if (!purchase) throw ApiError.notFound('Purchase not found');
    if (purchase.status === 'received') throw ApiError.badRequest('Cannot cancel received purchase');
    if (purchase.status === 'cancelled') throw ApiError.badRequest('Purchase already cancelled');

    await purchase.update({ status: 'cancelled' });
    return { message: 'Purchase cancelled' };
  }

  async pay(id, data, userId) {
    const purchase = await Purchase.findByPk(id);
    if (!purchase) throw ApiError.notFound('Purchase not found');
    if (purchase.paymentStatus === 'paid') throw ApiError.badRequest('Purchase already paid');
    if (purchase.status === 'cancelled') throw ApiError.badRequest('Cannot pay for cancelled purchase');

    const amount = parseFloat(data.amount);
    if (!amount || amount <= 0) throw ApiError.badRequest('Invalid payment amount');

    const currentPaid = parseFloat(purchase.paidAmount || 0);
    const total = parseFloat(purchase.total);
    const remaining = total - currentPaid;
    const actualAmount = Math.min(amount, remaining);

    const t = await sequelize.transaction();
    try {
      if (data.fundId) {
        const fund = await PettyCashFund.findByPk(data.fundId, { transaction: t, lock: true });
        if (!fund) throw ApiError.notFound('Petty cash fund not found');
        if (fund.status === 'closed') throw ApiError.badRequest('Fund is closed');
        if (parseFloat(fund.currentBalance) < actualAmount) throw ApiError.badRequest('Insufficient fund balance');

        const newFundBalance = parseFloat(fund.currentBalance) - actualAmount;
        await fund.update({ currentBalance: newFundBalance }, { transaction: t });

        await PettyCashTransaction.create({
          fundId: fund.id,
          type: 'withdrawal',
          amount: actualAmount,
          balanceAfter: newFundBalance,
          description: `Payment for Purchase Order #${purchase.orderNo}`,
          referenceType: 'Purchase',
          referenceId: purchase.id,
          userId,
        }, { transaction: t });
      }

      const newPaid = currentPaid + actualAmount;

      let paymentStatus = 'partial';
      if (newPaid >= total) paymentStatus = 'paid';

      await purchase.update({ paidAmount: newPaid, paymentStatus }, { transaction: t });

      await t.commit();
      return this.getById(id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
}

module.exports = new PurchaseService();
