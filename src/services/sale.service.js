const { Op, fn, col, literal } = require('sequelize');
const {
  Sale, SaleItem, Product, Customer, Payment, StockMovement, Notification, LoyaltyPoint, Discount, User, Role, sequelize,
} = require('../models');
const discountService = require('./discount.service');
const ApiError = require('../utils/ApiError');
const {
  generateInvoiceNo, calculateDiscount, calculateTax, getPagination, getPaginationMeta, escapeLike,
} = require('../utils/helpers');
const config = require('../config');

class SaleService {
  async canApplyManualDiscount(userId) {
    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: 'role', attributes: ['slug'] }],
    });
    return user?.role?.slug === 'admin' || user?.role?.slug === 'manager';
  }

  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};

    if (query.user?.role?.slug === 'cashier') {
      where.userId = query.user.id;
    }

    if (query.search) {
      const safeSearch = escapeLike(query.search);
      const { rows: customerRows } = await Customer.findAndCountAll({
        where: {
          [Op.or]: [
            { firstName: { [Op.like]: `%${safeSearch}%` } },
            { lastName: { [Op.like]: `%${safeSearch}%` } },
          ],
        },
        attributes: ['id'],
      });
      const customerIds = customerRows.map(c => c.id);
      const orConditions = [
        { invoiceNo: { [Op.like]: `%${safeSearch}%` } },
      ];
      if (customerIds.length > 0) {
        orConditions.push({ customerId: { [Op.in]: customerIds } });
      }
      where[Op.or] = orConditions;
    }
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    // Cashiers may only see their own sales; a client-supplied ?userId= must never widen that scope.
    if (query.userId && query.user?.role?.slug !== 'cashier') where.userId = query.userId;
    if (query.startDate && query.endDate) {
      where.createdAt = { [Op.between]: [new Date(query.startDate), new Date(query.endDate)] };
    } else if (query.startDate) {
      where.createdAt = { [Op.gte]: new Date(query.startDate) };
    } else if (query.endDate) {
      where.createdAt = { [Op.lte]: new Date(query.endDate) };
    }

    const sortBy = ['createdAt', 'invoiceNo', 'total', 'status', 'paymentMethod'].includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const { rows, count } = await Sale.findAndCountAll({
      where,
      include: [
        { association: 'customer', attributes: ['id', 'firstName', 'lastName', 'phone'] },
        { association: 'user', attributes: ['id', 'firstName', 'lastName'] },
      ],
      offset,
      limit,
      order: [[sortBy, sortOrder]],
    });

    return { sales: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id, user) {
    const sale = await Sale.findByPk(id, {
      include: [
        { association: 'items', include: [{ association: 'product', attributes: ['id', 'name', 'sku', 'barcode'] }] },
        { association: 'customer', attributes: ['id', 'firstName', 'lastName', 'phone'] },
        { association: 'user', attributes: ['id', 'firstName', 'lastName'] },
        { association: 'payments' },
      ],
    });
    if (!sale) throw ApiError.notFound('Sale not found');
    if (user && user.role?.slug === 'cashier' && String(sale.userId) !== String(user.id)) {
      throw ApiError.forbidden('You do not have access to this sale');
    }
    return sale;
  }

  async create(data, userId) {
    return this._createSale(data, userId, false);
  }

  async createPending(data, userId) {
    return this._createSale(data, userId, true);
  }

  async _createSale(data, userId, isPending) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });

    try {
      const invoiceNo = generateInvoiceNo('INV');

      let subtotal = 0;
      let totalProfit = 0;
      let totalItemTax = 0;
      let totalItemDiscount = 0;
      const items = [];

      for (const item of data.items) {
        // Use findOne with lock to ensure atomic stock check and update
        const product = await Product.findOne({
          where: { id: item.productId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!product) throw ApiError.notFound(`Product #${item.productId} not found`);
        if (!product.isActive) throw ApiError.badRequest(`Product ${product.name} is inactive`);

        const qty = parseInt(item.quantity, 10);
        if (product.stockQuantity < qty) {
          throw ApiError.badRequest(`Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`);
        }

        const previousStock = product.stockQuantity;
        const newStock = previousStock - qty;

        // Decrement atomically with a guard so two concurrent sales cannot
        // both pass the check above and oversell. The prior code computed
        // newStock but never persisted it, so sales left inventory untouched.
        const [stockRows] = await Product.update(
          { stockQuantity: literal(`stock_quantity - ${qty}`) },
          {
            where: { id: product.id, stockQuantity: { [Op.gte]: qty } },
            transaction: t,
          }
        );
        if (stockRows === 0) {
          throw ApiError.badRequest(`Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`);
        }

        const unitPrice = parseFloat(product.sellingPrice);
        const buyingPrice = parseFloat(product.buyingPrice);
        const itemSubtotal = unitPrice * item.quantity;
        const itemDiscount = calculateDiscount(itemSubtotal, item.discountType, item.discountValue || 0);
        const rawTaxRate = product.taxRate != null && product.taxRate !== ''
          ? parseFloat(product.taxRate)
          : null;
        const itemTaxRate = rawTaxRate === null
          ? config.app.taxRate
          : (rawTaxRate > 1 ? rawTaxRate / 100 : rawTaxRate);
        const itemTax = calculateTax(itemSubtotal - itemDiscount, itemTaxRate);
        const itemTotal = itemSubtotal - itemDiscount + itemTax;
      subtotal += itemSubtotal;
      totalItemTax += itemTax;
      totalItemDiscount += itemDiscount;
      totalProfit += ((unitPrice - (itemDiscount / item.quantity)) - buyingPrice) * item.quantity;

        items.push({
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          quantity: item.quantity,
          unitPrice,
          buyingPrice,
          discountType: item.discountType || null,
          discountValue: item.discountValue || 0,
          discountAmount: itemDiscount,
          taxRate: product.taxRate || config.app.taxRate,
          taxAmount: itemTax,
          subtotal: itemSubtotal,
          total: itemTotal,
          previousStock,
          newStock,
        });
      }

      let discountType = data.discountType || null;
      let discountValue = data.discountValue || 0;
      let maxDiscountAmount = null;

      if (data.discountId) {
        const discount = await Discount.findByPk(data.discountId, { transaction: t });
        if (!discount) throw ApiError.badRequest('Discount not found');
        if (!discount.isActive) throw ApiError.badRequest('Discount is no longer active');
        const today = new Date().toISOString().split('T')[0];
        if (discount.startDate && today < discount.startDate) throw ApiError.badRequest('Discount is not yet valid');
        if (discount.endDate && today > discount.endDate) throw ApiError.badRequest('Discount has expired');
        if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
          throw ApiError.badRequest('Promo code usage limit reached');
        }
        if (discount.minPurchaseAmount && parseFloat(subtotal) < parseFloat(discount.minPurchaseAmount)) {
          throw ApiError.badRequest(`Minimum purchase amount of ${discount.minPurchaseAmount} required for this discount`);
        }
        discountType = discount.type;
        discountValue = parseFloat(discount.value);
        maxDiscountAmount = discount.maxDiscountAmount != null && discount.maxDiscountAmount !== ''
          ? parseFloat(discount.maxDiscountAmount)
          : null;
      } else if (discountType || discountValue > 0) {
        // Manual discount without a server-resolved promo code: require admin/manager role.
        // Reject rather than silently zeroing it — a cashier attempting this used
        // to get a successful full-price sale with no error and no audit trail,
        // so the attempt disappeared entirely.
        const canManualDiscount = await this.canApplyManualDiscount(userId);
        if (!canManualDiscount) {
          throw ApiError.forbidden('Manual discounts require a manager or admin role');
        }
      }

      let saleDiscount = calculateDiscount(subtotal, discountType, discountValue);
      if (maxDiscountAmount != null && saleDiscount > maxDiscountAmount) {
        saleDiscount = maxDiscountAmount;
      }
      const saleSubtotal = subtotal;
      const saleTax = totalItemTax;
      // Item-level discounts (set per line) must reduce the payable total —
      // they were previously applied to the line items and tax base only, so
      // receipts showed discounted lines that did not add up to the total and
      // cash change was computed against the undiscounted amount.
      const total = saleSubtotal - totalItemDiscount - saleDiscount + saleTax + (parseFloat(data.shippingFee || 0));

      // A pending sale is an unpaid online checkout: the money has not arrived
      // yet, so it must not be recorded as paid and the customer must not be
      // credited loyalty points until finalizeAfterPayment confirms payment.
      const pending = Boolean(isPending);
      let cashAmt = null;
      if (pending) {
        if (data.paymentMethod === 'cash') {
          throw ApiError.badRequest('Cash sales cannot be created as pending');
        }
      } else {
        // Non-cash payments must be verified through the gateway (pending checkout flow).
        if (data.paymentMethod !== 'cash') {
          throw ApiError.badRequest('Non-cash payments must be processed through the online checkout flow');
        }

        // Cash payment must be provided and cover the total.
        const cashAmtProvided = data.cashAmount !== undefined && data.cashAmount !== null && data.cashAmount !== '';
        cashAmt = cashAmtProvided ? parseFloat(data.cashAmount) : NaN;
        if (!cashAmtProvided || Number.isNaN(cashAmt) || cashAmt < total) {
          throw ApiError.badRequest(`Insufficient cash. Total: ${total}, Received: ${cashAmtProvided ? cashAmt : 0}`);
        }
      }

      const sale = await Sale.create({
        invoiceNo,
        userId,
        customerId: data.customerId || null,
        discountId: data.discountId || null,
        subtotal: saleSubtotal,
        discountType: discountType,
        discountValue: discountValue,
        discountAmount: saleDiscount,
        taxAmount: saleTax,
        shippingFee: data.shippingFee || 0,
        total,
        profit: totalProfit,
        paymentStatus: pending ? 'pending' : 'paid',
        paymentMethod: data.paymentMethod || (pending ? 'gcash' : 'cash'),
        paymentReference: data.paymentReference || null,
        cashAmount: cashAmt,
        changeAmount: cashAmt == null ? null : parseFloat((cashAmt - total).toFixed(2)),
        notes: data.notes || null,
        status: pending ? 'pending' : 'completed',
      }, { transaction: t });

      for (const item of items) {
        await SaleItem.create({ ...item, saleId: sale.id }, { transaction: t });
        await StockMovement.create({
          productId: item.productId,
          userId,
          type: 'out',
          quantity: item.quantity,
          previousStock: item.previousStock,
          newStock: item.newStock,
          referenceType: 'Sale',
          referenceId: sale.id,
          notes: `Sale #${invoiceNo}`,
        }, { transaction: t });
      }

      if (!pending) {
        await Payment.create({
          saleId: sale.id,
          amount: total,
          paymentMethod: data.paymentMethod,
          reference: data.paymentReference || null,
          status: 'completed',
          paidAt: new Date(),
        }, { transaction: t });

        if (data.customerId) {
          await Customer.increment(
            { totalPurchases: total, visitCount: 1 },
            { where: { id: data.customerId }, transaction: t }
          );
          await Customer.update({ lastVisit: new Date() }, { where: { id: data.customerId }, transaction: t });
          const points = Math.floor(total / 100);
          if (points > 0) {
            const customer = await Customer.findByPk(data.customerId, { transaction: t });
            await LoyaltyPoint.create({
              customerId: data.customerId,
              saleId: sale.id,
              points,
              type: 'earned',
              balanceBefore: customer.loyaltyPoints,
              balanceAfter: customer.loyaltyPoints + points,
            }, { transaction: t });
            await Customer.update(
              { loyaltyPoints: customer.loyaltyPoints + points },
              { where: { id: data.customerId }, transaction: t }
            );
          }
        }

        await Notification.create({
          type: 'new_sale',
          title: `New Sale #${invoiceNo}`,
          message: `Sale of ${total} ${config.app.currency} completed`,
          data: { saleId: sale.id, invoiceNo, total },
        }, { transaction: t });

        if (data.discountId) {
          await discountService.incrementUsage(data.discountId, t);
        }
      } else {
        await Notification.create({
          type: 'pending_sale',
          title: `Pending Sale #${invoiceNo}`,
          message: `Sale of ${total} ${config.app.currency} awaiting payment`,
          data: { saleId: sale.id, invoiceNo, total },
        }, { transaction: t });
      }

      await t.commit();

      if (!pending && data.customerId) {
        try {
          const { sendEmail: doSend } = require('../utils/mailer');
          const { receiptEmail } = require('../utils/emailTemplates');
          const customer = await Customer.findByPk(data.customerId);
          if (customer && customer.email) {
            const saleData = await this.getById(sale.id);
            const items = (saleData.items || []).map(i => ({
              name: i.product?.name || 'Item',
              quantity: i.quantity,
              subtotal: i.total,
            }));
            await doSend({
              to: customer.email,
              subject: `Receipt - ${invoiceNo}`,
              html: receiptEmail(`${customer.firstName} ${customer.lastName}`, invoiceNo, items, total, data.paymentMethod),
            });
          }
        } catch (e) { /* email failure non-blocking */ }
      }

      return this.getById(sale.id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }


  async finalizeAfterPayment(saleId, transaction) {
    const sale = await Sale.findByPk(saleId, { transaction, lock: true });
    if (!sale) throw ApiError.notFound('Sale not found');

    if (sale.customerId) {
      const customer = await Customer.findByPk(sale.customerId, { transaction, lock: true });
      if (customer) {
        const balanceBefore = customer.loyaltyPoints || 0;
        await Customer.increment(
          { totalPurchases: parseFloat(sale.total), visitCount: 1 },
          { where: { id: sale.customerId }, transaction }
        );
        await Customer.update({ lastVisit: new Date() }, { where: { id: sale.customerId }, transaction });

        const points = Math.floor(parseFloat(sale.total) / 100);
        if (points > 0) {
          await LoyaltyPoint.create({
            customerId: sale.customerId,
            saleId: sale.id,
            points,
            type: 'earned',
            balanceBefore,
            balanceAfter: balanceBefore + points,
          }, { transaction });
          await Customer.update(
            { loyaltyPoints: balanceBefore + points },
            { where: { id: sale.customerId }, transaction }
          );
        }
      }
    }

    if (sale.discountId) {
      await discountService.incrementUsage(sale.discountId, transaction);
    }

    await Notification.create({
      type: 'new_sale',
      title: `New Sale #${sale.invoiceNo}`,
      message: `Sale of ${sale.total} ${config.app.currency} completed`,
      data: { saleId: sale.id, invoiceNo: sale.invoiceNo, total: sale.total },
    }, { transaction });

    return sale;
  }

  async emailReceiptForSale(saleId) {
    try {
      const { sendEmail: doSend } = require('../utils/mailer');
      const { receiptEmail } = require('../utils/emailTemplates');
      const sale = await this.getById(saleId);
      if (!sale || !sale.customerId || !sale.customer?.email) return;
      const items = (sale.items || []).map(i => ({
        name: i.product?.name || i.productName || 'Item',
        quantity: i.quantity,
        subtotal: i.total,
      }));
      await doSend({
        to: sale.customer.email,
        subject: `Receipt - ${sale.invoiceNo}`,
        html: receiptEmail(`${sale.customer.firstName} ${sale.customer.lastName}`, sale.invoiceNo, items, sale.total, sale.paymentMethod),
      });
    } catch (e) { /* email failure non-blocking */ }
  }

async cancel(id, userId) {
    const sale = await Sale.findByPk(id, { include: [{ association: 'items' }] });
    if (!sale) throw ApiError.notFound('Sale not found');
    if (sale.status === 'cancelled') return this.getById(id);
    if (sale.status === 'refunded') throw ApiError.badRequest('Sale already refunded');

    const onlineMethods = ['gcash', 'maya', 'credit_card', 'debit_card', 'bank_transfer'];
    if (sale.paymentStatus === 'paid' && onlineMethods.includes(sale.paymentMethod)) {
      throw ApiError.badRequest('Paid online orders must be refunded via the payment gateway before cancellation');
    }

    // Only restore stock for completed sales; pending sales don't affect stock
    const shouldRestoreStock = sale.status === 'completed';

    const t = await sequelize.transaction();
    try {
      if (shouldRestoreStock) {
        for (const item of sale.items) {
          const qty = parseInt(item.quantity, 10);
          const product = await Product.findByPk(item.productId, { transaction: t, lock: true });
          if (!product) continue;
          const previousStock = parseInt(product.stockQuantity, 10) || 0;
          const newStock = previousStock + qty;
          await product.update({ stockQuantity: newStock }, { transaction: t });
          await StockMovement.create({
            productId: item.productId,
            userId,
            type: 'in',
            quantity: qty,
            previousStock,
            newStock,
            referenceType: 'Sale',
            referenceId: sale.id,
            notes: `Cancelled sale #${sale.invoiceNo}`,
          }, { transaction: t });
        }

        if (sale.customerId) {
          const customer = await Customer.findByPk(sale.customerId, { transaction: t });
          if (customer) {
            const loyaltyPts = Math.floor(parseFloat(sale.total) / 100);
            await Customer.update(
              {
                totalPurchases: Math.max(0, parseFloat(customer.totalPurchases) - parseFloat(sale.total)),
                visitCount: Math.max(0, customer.visitCount - 1),
                loyaltyPoints: Math.max(0, customer.loyaltyPoints - loyaltyPts),
              },
              { where: { id: sale.customerId }, transaction: t }
            );
            if (loyaltyPts > 0) {
              await LoyaltyPoint.create({
                customerId: sale.customerId,
                saleId: sale.id,
                points: -loyaltyPts,
                type: 'adjusted',
                balanceBefore: customer.loyaltyPoints,
                balanceAfter: Math.max(0, customer.loyaltyPoints - loyaltyPts),
              }, { transaction: t });
            }
          }
        }
      }

      await Payment.update(
        { status: 'refunded' },
        { where: { saleId: sale.id }, transaction: t }
      );

      const notePrefix = shouldRestoreStock ? 'cancelled — stock restored' : 'cancelled';
      await sale.update({
        status: 'cancelled',
        paymentStatus: 'cancelled',
        notes: `Sale #${sale.invoiceNo} (${notePrefix})`,
      }, { transaction: t });

      await t.commit();
      return this.getById(id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async cancelPendingOnline(id, user) {
    const sale = await Sale.findByPk(id, { include: [{ association: 'items' }] });
    if (!sale) throw ApiError.notFound('Sale not found');

    const role = user && user.role ? user.role.slug : null;
    const isOwner = sale.userId && String(sale.userId) === String(user.id);
    if (!['admin', 'manager'].includes(role) && !isOwner) {
      throw ApiError.forbidden('You do not have access to this sale');
    }

    if (sale.status === 'cancelled') return this.getById(id);
    if (sale.status !== 'pending' || sale.paymentStatus !== 'pending') {
      throw ApiError.badRequest('Only unpaid pending sales can be cancelled');
    }

    const t = await sequelize.transaction();
    try {
      // Claim the sale under a row lock before restoring stock. The checks above
      // read without a lock, so a concurrent cancel (user + expiry cron) could
      // both pass them and restore the same stock twice.
      const lockedSale = await Sale.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!lockedSale) throw ApiError.notFound('Sale not found');
      if (lockedSale.status !== 'pending' || lockedSale.paymentStatus !== 'pending') {
        await t.rollback();
        return this.getById(id);
      }

      for (const item of sale.items) {
        const qty = parseInt(item.quantity, 10);
        const product = await Product.findByPk(item.productId, { transaction: t, lock: true });
        if (!product) continue;
        const previousStock = parseInt(product.stockQuantity, 10) || 0;
        const newStock = previousStock + qty;
        await product.update({ stockQuantity: newStock }, { transaction: t });
        await StockMovement.create({
          productId: item.productId,
          userId: user.id,
          type: 'in',
          quantity: qty,
          previousStock,
          newStock,
          referenceType: 'Sale',
          referenceId: sale.id,
          notes: `Cancelled pending sale #${sale.invoiceNo} — stock restored`,
        }, { transaction: t });
      }

      await sale.update({
        status: 'cancelled',
        paymentStatus: 'cancelled',
        notes: `Pending sale #${sale.invoiceNo} (cancelled — stock restored)`,
      }, { transaction: t });

      await t.commit();
      return this.getById(id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async getByInvoice(invoiceNo, user) {
    const sale = await Sale.findOne({
      where: { invoiceNo },
      include: [
        { association: 'items', include: [{ association: 'product' }] },
        { association: 'customer' },
        { association: 'user', attributes: ['id', 'firstName', 'lastName'] },
      ],
    });
    if (!sale) throw ApiError.notFound('Sale not found');
    if (user && user.role?.slug === 'cashier' && String(sale.userId) !== String(user.id)) {
      throw ApiError.forbidden('You do not have access to this sale');
    }
    return sale;
  }

  async getSalesReport(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let totalSales = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    try {
      const summary = await Sale.findOne({
        attributes: [
          [fn('COUNT', col('id')), 'totalSales'],
          [fn('COALESCE', fn('SUM', col('total')), 0), 'totalRevenue'],
          [fn('COALESCE', fn('SUM', col('profit')), 0), 'totalProfit'],
          [fn('COALESCE', fn('SUM', col('tax_amount')), 0), 'totalTax'],
          [fn('COALESCE', fn('SUM', col('discount_amount')), 0), 'totalDiscount'],
        ],
        where: {
          status: 'completed',
          createdAt: { [Op.between]: [start, end] },
        },
        raw: true,
      });
      totalSales = parseInt(summary?.totalSales || 0, 10);
      totalRevenue = parseFloat(summary?.totalRevenue || 0);
      totalProfit = parseFloat(summary?.totalProfit || 0);
      totalTax = parseFloat(summary?.totalTax || 0);
      totalDiscount = parseFloat(summary?.totalDiscount || 0);
    } catch (e) {
      console.error('Sales report summary error:', e.message);
    }

    let dailyBreakdown = {};
    try {
      const isSQLite = sequelize.getDialect() === 'sqlite';
      const dateExpr = isSQLite ? "date(created_at)" : "DATE(created_at)";
      const rawDaily = await sequelize.query(`
        SELECT ${dateExpr} as date,
               COUNT(*) as sales,
               COALESCE(SUM(total), 0) as revenue,
               COALESCE(SUM(profit), 0) as profit
        FROM sales
        WHERE created_at BETWEEN :startDate AND :endDate AND status = 'completed'
        GROUP BY ${dateExpr}
        ORDER BY ${dateExpr} ASC
      `, {
        replacements: { startDate: start.toISOString(), endDate: end.toISOString() },
        type: sequelize.QueryTypes.SELECT,
      });
      rawDaily.forEach((d) => {
        dailyBreakdown[d.date] = {
          sales: parseInt(d.sales, 10),
          revenue: parseFloat(d.revenue || 0),
          profit: parseFloat(d.profit || 0),
        };
      });
    } catch (e) {
      console.error('Sales report daily breakdown error:', e.message);
    }

    return {
      totalSales,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      totalDiscount: parseFloat(totalDiscount.toFixed(2)),
      averageOrderValue: totalSales > 0 ? parseFloat((totalRevenue / totalSales).toFixed(2)) : 0,
      dailyBreakdown,
      period: { startDate, endDate },
    };
  }
}

module.exports = new SaleService();
