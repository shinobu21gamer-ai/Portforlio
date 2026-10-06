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
const { logActivity } = require('../utils/audit');
const { sqlLocalDateExpr, localDateBoundsForDate } = require('../utils/timezone');

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
        { association: 'customer', attributes: ['id', 'firstName', 'lastName', 'phone', 'email'] },
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
        // email is required for receipt delivery (sendReceiptEmail reads it
        // off this association) — omitting it silently killed every receipt.
        { association: 'customer', attributes: ['id', 'firstName', 'lastName', 'phone', 'email'] },
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
      } else if (data.paymentMethod === 'split') {
        // Split tender: every leg must be named + positive and the legs must
        // sum to the total exactly (no change in a split).
        const legs = Array.isArray(data.payments) ? data.payments : [];
        const legSum = Math.round(legs.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0) * 100) / 100;
        if (legs.length < 2 || legSum !== Math.round(total * 100) / 100) {
          throw ApiError.badRequest(`Split legs must sum to the total (${total}). Received: ${legSum}`);
        }
        cashAmt = legs.filter((l) => l.paymentMethod === 'cash')
          .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0) || null;
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
        // No change in a split tender (legs must cover exactly) — only
        // single-cash sales compute change.
        changeAmount: cashAmt == null || data.paymentMethod === 'split' ? null : parseFloat((cashAmt - total).toFixed(2)),
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
        if (data.paymentMethod === 'split') {
          // One ledger row per leg so the mix is auditable (receipts list legs).
          for (const leg of data.payments) {
            await Payment.create({
              saleId: sale.id,
              amount: parseFloat(leg.amount),
              paymentMethod: leg.paymentMethod,
              reference: leg.reference || null,
              status: 'completed',
              paidAt: new Date(),
            }, { transaction: t });
          }
        } else {
          await Payment.create({
            saleId: sale.id,
            amount: total,
            paymentMethod: data.paymentMethod,
            reference: data.paymentReference || null,
            status: 'completed',
            paidAt: new Date(),
          }, { transaction: t });
        }

        // Shift attribution: net cash entering the register for this sale.
        // Cash: the total (tendered cash minus returned change = total).
        // Split: only the cash leg(s). Non-cash: nothing.
        try {
          const shiftService = require('./shift.service');
          const shiftCash = data.paymentMethod === 'split'
            ? (cashAmt || 0)
            : (data.paymentMethod === 'cash' ? total : 0);
          if (shiftCash > 0) await shiftService.adjustOpenShift(userId, shiftCash, t);
        } catch (e) {
          if (e?.code !== 'MODULE_NOT_FOUND') throw e;
        }

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
              html: receiptEmail(`${customer.firstName} ${customer.lastName}`, invoiceNo, items, total, data.paymentMethod, saleData.payments),
            });
          }
        } catch { /* email failure non-blocking */ }
      }

      return this.getById(sale.id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }


  /**
   * Admin/manager escape hatch for a pending online sale: the customer's
   * gateway payment never went through (card declined, closed the tab,
   * PayMongo down) but they are standing at the counter paying cash.
   * Marks the sale paid/cash, records the payment and runs the same
   * finalization as the online path (loyalty, discount usage, notification).
   * Stock was already reserved when the pending sale was created.
   */
  async completePendingAsCash(saleId, user) {
    if (!(await this.canApplyManualDiscount(user?.id || user))) {
      throw ApiError.forbidden('Only a manager or admin can complete a pending sale as cash');
    }

    const overrideRef = `CASH-OVERRIDE-${Date.now()}`;
    return sequelize.transaction(async (t) => {
      const sale = await Sale.findByPk(saleId, { transaction: t, lock: true });
      if (!sale) throw ApiError.notFound('Sale not found');
      if (sale.paymentStatus === 'paid') {
        throw ApiError.conflict('Sale is already marked as paid');
      }
      if (sale.status === 'cancelled') {
        throw ApiError.conflict('Sale has been cancelled and cannot be completed');
      }
      if (sale.status !== 'pending') {
        throw ApiError.conflict(`Sale cannot be completed from status "${sale.status}"`);
      }

      await sale.update({
        paymentStatus: 'paid',
        status: 'completed',
        paymentMethod: 'cash',
        paymentReference: overrideRef,
      }, { transaction: t });

      const existingPayment = await Payment.findOne({ where: { saleId: sale.id }, transaction: t });
      if (existingPayment) {
        await existingPayment.update({
          status: 'completed',
          paymentMethod: 'cash',
          reference: overrideRef,
          paidAt: new Date(),
        }, { transaction: t });
      } else {
        await Payment.create({
          saleId: sale.id,
          amount: sale.total,
          paymentMethod: 'cash',
          reference: overrideRef,
          status: 'completed',
          paidAt: new Date(),
        }, { transaction: t });
      }

      // Cash entered the register — attribute to the operator's open shift.
      try {
        const shiftService = require('./shift.service');
        await shiftService.adjustOpenShift(user?.id, parseFloat(sale.total) || 0, t);
      } catch (e) {
        if (e?.code !== 'MODULE_NOT_FOUND') throw e;
      }

      await this.finalizeAfterPayment(sale.id, t, {
        actorId: user?.id || null,
        source: 'manager cash override',
      });
      const completed = await Sale.findByPk(sale.id, {
        transaction: t,
        include: [
          { association: 'items', include: [{ association: 'product', attributes: ['id', 'name', 'sku', 'barcode'] }] },
          { association: 'payments' },
        ],
      });
      return completed;
    });
  }

  async finalizeAfterPayment(saleId, transaction, audit = {}) {
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

    const source = audit.source || 'payment gateway';
    await logActivity(audit.actorId || null, 'sale-payment-confirmed', 'Sales', {
      referenceType: 'Sale',
      referenceId: sale.id,
      description: `Payment confirmed for ${sale.invoiceNo} via ${source}`,
      oldData: { status: 'pending', paymentStatus: 'pending' },
      newData: {
        invoiceNo: sale.invoiceNo,
        status: sale.status,
        paymentStatus: sale.paymentStatus,
        paymentMethod: sale.paymentMethod,
        total: parseFloat(sale.total) || 0,
      },
    }, transaction);

    return sale;
  }

  // Fire-and-forget receipt (payment webhooks): never throws, logs failures.
  async emailReceiptForSale(saleId) {
    try {
      await this.sendReceiptEmail(saleId);
    } catch (e) {
      console.error(`[EMAIL] Receipt for sale ${saleId} not sent: ${e.message}`);
    }
  }

  // Strict receipt send — used by the manual resend route so the caller
  // gets a real error when there's no customer email or SMTP fails.
  async sendReceiptEmail(saleId) {
    const { sendEmail: doSend } = require('../utils/mailer');
    const { receiptEmail } = require('../utils/emailTemplates');
    const sale = await this.getById(saleId);
    if (!sale || !sale.customerId || !sale.customer?.email) {
      throw ApiError.badRequest('This sale has no customer email address to send the receipt to');
    }
    const items = (sale.items || []).map(i => ({
      name: i.product?.name || i.productName || 'Item',
      quantity: i.quantity,
      subtotal: i.total,
    }));
    await doSend({
      to: sale.customer.email,
      subject: `Receipt - ${sale.invoiceNo}`,
      html: receiptEmail(`${sale.customer.firstName} ${sale.customer.lastName}`, sale.invoiceNo, items, sale.total, sale.paymentMethod, sale.payments),
    });
    return { sent: true, to: sale.customer.email };
  }

  async cancel(id, userId) {
    const t = await sequelize.transaction();
    try {
      // Row-lock BEFORE reading so two concurrent cancels can't both pass
      // the status check and double-restock (same pattern as
      // cancelPendingOnline).
      const sale = await Sale.findByPk(id, {
        include: [{ association: 'items' }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!sale) throw ApiError.notFound('Sale not found');
      if (sale.status === 'cancelled') { await t.rollback(); return this.getById(id); }
      if (sale.status === 'refunded') throw ApiError.badRequest('Sale already refunded');

      const onlineMethods = ['gcash', 'maya', 'credit_card', 'debit_card', 'bank_transfer'];
      if (sale.paymentStatus === 'paid' && onlineMethods.includes(sale.paymentMethod)) {
        throw ApiError.badRequest('Paid online orders must be refunded via the payment gateway before cancellation');
      }

      // Only restore stock for completed sales; pending sales don't affect stock
      const shouldRestoreStock = sale.status === 'completed';
      if (shouldRestoreStock) {
        for (const item of sale.items) {
          // Only restock what hasn't already been refunded.
          const qty = parseInt(item.quantity, 10) - (parseInt(item.refundedQuantity, 10) || 0);
          if (qty <= 0) continue;
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

  /**
   * Refund a completed sale — full or partial per line.
   *
   * - Restocks each refunded quantity (row-locked) and logs a StockMovement.
   * - Records the refund as a negative-amount Payment row (ledger/audit trail;
   *   finance reports aggregate from sales, not the payments table).
   * - Reverses customer stats/loyalty pro-rata to the refunded amount.
   * - Full refund → status 'refunded'; partial → paymentStatus 'partially_refunded'.
   *
   * Authorization:
   *   admin / manager — any completed sale, full or partial.
   *   cashier — their own CASH sale only, completed within the last 15
   *   minutes, full refund only (counter-mistake flow).
   */
  async refund(saleId, data, user) {
    const reason = (data?.reason || '').trim();
    if (!reason) throw ApiError.badRequest('A refund reason is required');

    const requestedLines = Array.isArray(data?.items) && data.items.length
      ? data.items
      : null; // no items → full refund

    const t = await sequelize.transaction();
    try {
      const sale = await Sale.findByPk(saleId, {
        include: [{ association: 'items' }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!sale) throw ApiError.notFound('Sale not found');

      if (sale.status === 'refunded') throw ApiError.conflict('Sale is already fully refunded');
      if (sale.status !== 'completed') throw ApiError.conflict(`Sale is ${sale.status} — only completed sales can be refunded`);
      if (!['paid', 'partially_refunded'].includes(sale.paymentStatus)) {
        throw ApiError.conflict('Sale payment is not in a refundable state');
      }

      // ── Role rules ────────────────────────────────────────────────
      const role = user?.role?.slug;
      if (!['admin', 'manager'].includes(role)) {
        const doneAt = new Date(Math.max(new Date(sale.createdAt).getTime(), new Date(sale.updatedAt).getTime()));
        const withinWindow = Date.now() - doneAt.getTime() <= 15 * 60 * 1000;
        const ownCashSale = String(sale.userId) === String(user?.id) && sale.paymentMethod === 'cash';
        if (role !== 'cashier' || !ownCashSale || !withinWindow) {
          throw ApiError.forbidden('Only admins/managers can refund this sale (cashiers may void their own cash sale within 15 minutes)');
        }
        if (requestedLines) {
          throw ApiError.badRequest('Cashier voids must be a full refund — select all items');
        }
      }

      // ── Resolve refund lines + amount ─────────────────────────────
      const lines = [];
      if (requestedLines) {
        for (const line of requestedLines) {
          const itemRow = sale.items.find((i) => String(i.id) === String(line.saleItemId));
          if (!itemRow) throw ApiError.badRequest(`Item ${line.saleItemId} is not part of this sale`);
          const remaining = parseInt(itemRow.quantity, 10) - (parseInt(itemRow.refundedQuantity, 10) || 0);
          const qty = Math.max(0, parseInt(line.quantity, 10) || 0);
          // Reject over-requests rather than silently clamping — a refund for
          // 3 when only 1 remains is a signal of a double-processed void.
          if (qty > remaining) {
            throw ApiError.conflict(`Only ${remaining} unit(s) of ${itemRow.productName} remain refundable`);
          }
          if (qty <= 0) throw ApiError.conflict(`No remaining refundable quantity for ${itemRow.productName}`);
          lines.push({ itemRow, qty });
        }
      } else {
        for (const itemRow of sale.items) {
          const remaining = parseInt(itemRow.quantity, 10) - (parseInt(itemRow.refundedQuantity, 10) || 0);
          if (remaining > 0) lines.push({ itemRow, qty: remaining });
        }
      }
      if (!lines.length) throw ApiError.conflict('Nothing left to refund on this sale');

      let refundAmount = 0;
      for (const { itemRow, qty } of lines) {
        // Pro-rata per unit (keeps tax/discount share exact per line).
        refundAmount += (parseFloat(itemRow.total) / parseInt(itemRow.quantity, 10)) * qty;
      }
      refundAmount = Math.round(refundAmount * 100) / 100;
      if (refundAmount <= 0) throw ApiError.badRequest('Refund amount must be greater than zero');

      // ── Restock + stock movements ─────────────────────────────────
      for (const { itemRow, qty } of lines) {
        const product = await Product.findByPk(itemRow.productId, { transaction: t, lock: t.LOCK.UPDATE });
        if (product) {
          const previousStock = parseInt(product.stockQuantity, 10) || 0;
          const newStock = previousStock + qty;
          await product.update({ stockQuantity: newStock }, { transaction: t });
          await StockMovement.create({
            productId: itemRow.productId,
            userId: user?.id,
            type: 'in',
            quantity: qty,
            previousStock,
            newStock,
            referenceType: 'SaleRefund',
            referenceId: sale.id,
            notes: `Refund #${sale.invoiceNo}: ${qty} x ${itemRow.productName} — ${reason}`,
          }, { transaction: t });
        }
        await itemRow.update(
          { refundedQuantity: (parseInt(itemRow.refundedQuantity, 10) || 0) + qty },
          { transaction: t }
        );
      }

      // ── Ledger row ────────────────────────────────────────────────
      await Payment.create({
        saleId: sale.id,
        amount: -refundAmount,
        paymentMethod: sale.paymentMethod === 'split' ? 'other' : sale.paymentMethod,
        reference: `REFUND-${sale.invoiceNo}`,
        status: 'refunded',
        paidAt: new Date(),
      }, { transaction: t });

      // ── Sale status ───────────────────────────────────────────────
      const total = parseFloat(sale.total) || 0;
      const alreadyRefunded = parseFloat(sale.refundedAmount) || 0;
      const fullyRefunded = alreadyRefunded + refundAmount >= total - 0.005;
      await sale.update({
        refundedAmount: Math.min(total, alreadyRefunded + refundAmount),
        status: fullyRefunded ? 'refunded' : 'completed',
        paymentStatus: fullyRefunded ? 'refunded' : 'partially_refunded',
        notes: `${sale.notes ? sale.notes + '\n' : ''}[refund ${new Date().toISOString()}] ${reason}`,
      }, { transaction: t });

      // ── Customer reversal (pro-rata) ──────────────────────────────
      if (sale.customerId) {
        const customer = await Customer.findByPk(sale.customerId, { transaction: t });
        if (customer) {
          const loyaltyPts = Math.floor(refundAmount / 100);
          await Customer.update(
            {
              totalPurchases: Math.max(0, parseFloat(customer.totalPurchases) - refundAmount),
              visitCount: fullyRefunded ? Math.max(0, customer.visitCount - 1) : customer.visitCount,
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

      // ── Open-shift cash adjustment (Phase 4 shifts) ──────────────
      // Only the cash portion of a refund leaves the register.
      if (sale.paymentMethod === 'cash' || sale.paymentMethod === 'split') {
        const paidLegs = await Payment.findAll({
          where: { saleId: sale.id, status: 'completed' },
          transaction: t,
        });
        const paidTotal = paidLegs.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) || total;
        const cashPaid = paidLegs
          .filter((p) => p.paymentMethod === 'cash')
          .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const cashRefund = Math.round(refundAmount * (cashPaid / paidTotal) * 100) / 100;
        if (cashRefund > 0) {
          try {
            const shiftService = require('./shift.service');
            await shiftService.adjustOpenShift(user?.id, -cashRefund, t);
          } catch (e) {
            if (e?.code !== 'MODULE_NOT_FOUND') throw e;
          }
        }
      }

      await Notification.create({
        type: 'refund',
        title: `Refund: ${sale.invoiceNo}`,
        message: `${fullyRefunded ? 'Full' : 'Partial'} refund of ${refundAmount.toFixed(2)} — ${reason}`,
        data: { saleId: sale.id, invoiceNo: sale.invoiceNo, refundAmount, reason, by: user?.id },
      }).catch(() => {});

      await t.commit();
      return {
        sale: await this.getById(saleId, user),
        refundAmount,
        fullyRefunded,
        refundedItems: lines.map(({ itemRow, qty }) => ({ saleItemId: itemRow.id, productName: itemRow.productName, quantity: qty })),
      };
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
    // Report dates are local calendar dates (business timezone) — resolve
    // them to UTC-instant bounds instead of trusting the server's local zone.
    const tz = config.app.timezone;
    const start = localDateBoundsForDate(tz, startDate).start;
    const end = localDateBoundsForDate(tz, endDate).end;

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
          createdAt: { [Op.gte]: start, [Op.lt]: end },
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
      const localDayExpr = sqlLocalDateExpr('created_at', config.app.timezone, sequelize.getDialect());
      const rawDaily = await sequelize.query(`
        SELECT ${localDayExpr} as date,
               COUNT(*) as sales,
               COALESCE(SUM(total), 0) as revenue,
               COALESCE(SUM(profit), 0) as profit
        FROM sales
        WHERE created_at >= :startDate AND created_at < :endDate AND status = 'completed'
        GROUP BY ${localDayExpr}
        ORDER BY ${localDayExpr} ASC
      `, {
        replacements: { startDate: start, endDate: end },
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
