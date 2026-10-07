const express = require('express');
const router = express.Router();
const paymongoService = require('../services/paymongo.service');
const saleService = require('../services/sale.service');
const { sendSuccess } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');
const { Sale, Payment, sequelize } = require('../models');

const assertSaleAccess = (sale, user) => {
  if (!sale) throw ApiError.notFound('Sale not found');
  const role = user && user.role ? user.role.slug : null;
  if (['admin', 'manager'].includes(role)) return;
  if (sale.userId && String(sale.userId) === String(user.id)) return;
  if (sale.customerId && String(sale.customerId) === String(user.id)) return;
  throw ApiError.forbidden('You do not have access to this sale');
};

// Public base URL for PayMongo's success/cancel redirects.
//
// Priority:
//   1. POS_FRONTEND_URL — the explicit, always-correct answer.
//   2. The browser Origin/Referer the checkout request came from. Behind any
//      reverse proxy (nginx, Render, the dev server, a preview sandbox) the
//      request Host is the *API* host, so building the redirect from it sent
//      the customer to the API origin — a page that is not the POS at all.
//   3. X-Forwarded-Host / X-Forwarded-Proto, then req.protocol/host.
//
// This must never fall back to a localhost default: PayMongo rejects non-HTTPS
// success_url in live mode, and on test mode it would redirect the customer to
// their own machine.
function resolvePublicOrigin(req, configuredUrl) {
  if (configuredUrl) return String(configuredUrl).replace(/\/+$/, '');

  const fromHeader = (value) => {
    if (!value) return null;
    let candidate = String(value).split(',')[0].trim();
    if (!candidate) return null;
    // Origin is scheme://host already; Referer is a full URL.
    try {
      const url = new URL(candidate);
      return `${url.protocol}//${url.host}`;
    } catch { /* not a URL — treat it as a bare host below */ }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) return null;
    const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
      || req.protocol
      || 'https';
    return `${proto}://${candidate.replace(/\/+$/, '')}`;
  };

  const fromBrowser = fromHeader(req.headers.origin) || fromHeader(req.headers.referer);
  if (fromBrowser && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(fromBrowser)) {
    return fromBrowser;
  }

  // Render/nginx set X-Forwarded-Host to the host the browser actually used.
  const forwarded = fromHeader(req.headers['x-forwarded-host']);
  if (forwarded) return forwarded;

  return String(`${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

// Lets the register explain itself instead of failing at the last click: the
// POS hides/warns about the e-wallet path when PayMongo keys are missing.
router.get('/config', protect, async (req, res) => {
  sendSuccess(res, {
    provider: 'paymongo',
    onlinePaymentsEnabled: paymongoService.isConfigured(),
    enabledWallets: ['gcash', 'maya', 'card'],
  });
});

router.get('/test', protect, authorize('admin'), async (req, res) => {
  try {
    if (!paymongoService.isConfigured()) {
      return sendSuccess(res, { configured: false, message: 'PayMongo secret key not set' });
    }
    const pi = await paymongoService.createPaymentIntent({ amount: 1, description: 'Test connection', metadata: { test: 'true' } });
    sendSuccess(res, { configured: true, paymentIntentId: pi.id, status: pi.attributes?.status }, 'PayMongo is reachable');
  } catch (err) {
    console.error('PayMongo test failed:', err.response?.data || err.message);
    sendSuccess(res, { configured: true, error: 'PayMongo API error' }, 'PayMongo API error');
  }
});

router.post('/create-checkout', protect, validate(schemas.createCheckout), async (req, res, next) => {
  try {
    const { description, saleId } = req.body;

    // Server-authoritative amount & line items: a checkout is only ever created
    // for an existing pending sale on the server. Client-supplied amounts are
    // never trusted and there is no client-amount path.
    if (!saleId) {
      throw ApiError.badRequest('saleId is required');
    }

    const sale = await Sale.findByPk(saleId, {
      include: [{ association: 'items' }],
    });
    assertSaleAccess(sale, req.user);
    if (sale.status !== 'pending') {
      throw ApiError.badRequest('Sale is not pending; a checkout cannot be created for it');
    }

    const saleTotal = parseFloat(sale.total);
    if (!Number.isFinite(saleTotal) || saleTotal <= 0) {
      throw ApiError.badRequest('Sale total is invalid; cannot create checkout');
    }

    const serverItems = (sale.items || []).map((i) => ({
      name: i.productName || 'Item',
      amount: parseFloat(i.unitPrice || 0),
      quantity: parseInt(i.quantity, 10) || 1,
    }));
    const serverSum = serverItems.reduce((a, i) => a + i.amount * i.quantity, 0);
    const delta = parseFloat((saleTotal - serverSum).toFixed(2));

    let checkoutItems;
    if (serverItems.length > 0 && delta >= 0) {
      const itemsToSend = serverItems.slice();
      if (delta > 0) itemsToSend.push({ name: 'Tax & Adjustments', amount: delta, quantity: 1 });
      checkoutItems = itemsToSend;
    } else {
      checkoutItems = [{ name: `MiniMart POS - ${sale.invoiceNo}`, amount: saleTotal, quantity: 1 }];
    }

    let paymentMethodTypes = ['gcash', 'paymaya', 'card'];
    if (sale.paymentMethod === 'gcash') paymentMethodTypes = ['gcash'];
    else if (sale.paymentMethod === 'maya') paymentMethodTypes = ['paymaya'];

    const config = require('../config');
    const posUrl = resolvePublicOrigin(req, config.app.posFrontendUrl);
    const result = await paymongoService.createCheckoutSession({
      amount: saleTotal,
      description: description || `MiniMart POS - Sale #${saleId}`,
      lineItems: checkoutItems,
      paymentMethodTypes,
      metadata: { saleId, userId: String(req.user.id) },
      successUrl: `${posUrl}/payment/success?saleId=${saleId}&session_id={checkout_session.id}`,
      cancelUrl: `${posUrl}/payment/cancel?saleId=${saleId}`,
    });

    const checkoutUrl = result.attributes?.checkout_url;
    if (!checkoutUrl) {
      console.error('PayMongo returned no checkout_url:', JSON.stringify(result));
      throw ApiError.internal('PayMongo did not return a checkout URL');
    }

    // Remember which gateway session belongs to this sale. PayMongo's success
    // URL placeholder is not guaranteed to survive the round trip, so the
    // return page must be able to verify without relying on the query string —
    // otherwise a paid order sits at "waiting for confirmation" until (and
    // unless) the webhook arrives.
    if (result.id) {
      await sale.update({ paymentReference: result.id });
    }

    console.log('PayMongo checkout created:', { sessionId: result.id, checkoutUrl });
    sendSuccess(res, {
      checkoutUrl,
      sessionId: result.id,
      returnUrl: `${posUrl}/payment/success?saleId=${saleId}`,
    }, 'Checkout session created');
  } catch (err) {
    const detail = err.response?.data?.errors?.[0]?.detail || err.response?.data || err.message;
    console.error('Create checkout error:', detail);
    next(err);
  }
});

router.get('/status/:saleId', protect, async (req, res, next) => {
  try {
    const sale = await Sale.findByPk(req.params.saleId, {
      include: [{ association: 'payments' }],
    });
    assertSaleAccess(sale, req.user);

    sendSuccess(res, {
      saleId: sale.id,
      status: sale.status,
      paymentStatus: sale.paymentStatus,
      paymentMethod: sale.paymentMethod,
      payments: sale.payments,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/verify/:saleId', protect, async (req, res, next) => {
  try {
    // A gateway placeholder that never got substituted ({checkout_session.id})
    // is not an id: ignore anything that is not a real PayMongo session id and
    // fall back to the session stamped on the sale at checkout creation.
    const rawSessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
    const querySessionId = /^(cs_|pi_|link_)[A-Za-z0-9]+$/.test(rawSessionId) ? rawSessionId : '';

    let sale = await Sale.findByPk(req.params.saleId, {
      include: [{ association: 'items' }, { association: 'payments' }],
    });
    assertSaleAccess(sale, req.user);

    if (sale.paymentStatus === 'paid') {
      return sendSuccess(res, { verified: true, paymentStatus: 'paid', ...sale.toJSON() }, 'Payment already confirmed');
    }

    if (sale.status === 'cancelled') {
      throw ApiError.conflict('Sale has been cancelled and cannot be verified');
    }

    const storedReference = /^(cs_|pi_|link_)[A-Za-z0-9]+$/.test(String(sale.paymentReference || ''))
      ? String(sale.paymentReference)
      : '';
    const sessionId = querySessionId || storedReference;

    if (!sessionId || !paymongoService.isConfigured()) {
      return sendSuccess(res, { verified: false, paymentStatus: sale.paymentStatus }, 'Payment not yet confirmed');
    }

    let isPaid = false;
    try {
      const session = await paymongoService.retrieveCheckoutSession(sessionId);

      // Bind the session to this sale. create-checkout stamps metadata.saleId;
      // without checking it, a caller who can read sale A could present a paid
      // session belonging to sale B and mark A completed.
      const sessionSaleId = session.attributes?.metadata?.saleId;
      if (sessionSaleId && String(sessionSaleId) !== String(sale.id)) {
        throw ApiError.badRequest('Payment session does not belong to this sale');
      }

      const sessionStatus = session.attributes?.status;
      const paymentStatus = session.attributes?.payments?.[0]?.attributes?.status;
      const piId = session.attributes?.payment_intent?.id;
      const piStatus = session.attributes?.payment_intent?.attributes?.status;

      console.log(`PayMongo verify session ${sessionId}: sessionStatus=${sessionStatus}, paymentStatus=${paymentStatus}, piId=${piId}, piStatus=${piStatus}`);

      if (paymentStatus === 'paid') {
        isPaid = true;
      } else if (sessionStatus === 'completed') {
        isPaid = true;
      } else if (piStatus === 'succeeded') {
        isPaid = true;
      } else if (piId) {
        try {
          const pi = await paymongoService.retrievePaymentIntent(piId);
          const piLatestStatus = pi.attributes?.status;
          console.log(`PayMongo verify PI ${piId}: status=${piLatestStatus}`);
          if (piLatestStatus === 'succeeded') isPaid = true;
        } catch (piErr) {
          console.error('PayMongo PI retrieval error:', piErr.response?.data || piErr.message);
        }
      }

      if (isPaid) {
        let updatedSale;
        await sequelize.transaction(async (t) => {
          const lockedSale = await Sale.findByPk(req.params.saleId, {
            transaction: t,
            lock: true,
            include: [{ association: 'items' }, { association: 'payments' }],
          });
          if (!lockedSale) throw ApiError.notFound('Sale not found');
          if (lockedSale.paymentStatus === 'paid') {
            updatedSale = lockedSale;
            return;
          }
          if (lockedSale.status === 'cancelled') {
            throw ApiError.conflict('Sale has been cancelled and cannot be completed');
          }
          if (lockedSale.status !== 'pending') {
            throw ApiError.conflict(`Sale cannot be completed from status "${lockedSale.status}"`);
          }

          await lockedSale.update({ paymentStatus: 'paid', status: 'completed', paymentReference: sessionId }, { transaction: t });

          const existingPayment = await Payment.findOne({ where: { saleId: lockedSale.id }, transaction: t });
          if (existingPayment) {
            await existingPayment.update({ status: 'completed', reference: sessionId, paidAt: new Date() }, { transaction: t });
          } else {
            await Payment.create({
              saleId: lockedSale.id,
              amount: lockedSale.total,
              paymentMethod: lockedSale.paymentMethod,
              reference: sessionId,
              status: 'completed',
              paidAt: new Date(),
            }, { transaction: t });
          }

          await saleService.finalizeAfterPayment(lockedSale.id, t, {
            actorId: req.user?.id || null,
            source: 'PayMongo payment verification',
          });

          updatedSale = lockedSale;
        });

        console.log(`PayMongo verify: Sale ${updatedSale.id} marked as paid via session verification`);
        await saleService.emailReceiptForSale(updatedSale.id);
        return sendSuccess(res, { verified: true, paymentStatus: 'paid', ...updatedSale.toJSON() }, 'Payment confirmed');
      }
    } catch (apiErr) {
      if (apiErr instanceof ApiError) throw apiErr;
      console.error('PayMongo session retrieval error:', apiErr.response?.data || apiErr.message);
    }

    sendSuccess(res, { verified: false, paymentStatus: sale.paymentStatus }, 'Payment not yet confirmed');
  } catch (err) {
    next(err);
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const sig = req.headers['paymongo-signature'] || '';

    if (!paymongoService.verifyWebhookSignature(req.body, sig, req.rawBody)) {
      console.warn('Invalid PayMongo webhook signature');
      return res.status(400).json({ received: false, error: 'Invalid signature' });
    }

    const event = req.body;
    const eventType =
      event.data?.attributes?.type ||
      event.data?.type ||
      event.type;

    const isCheckoutPaid = [
      'checkout_session.payment.paid',
      'checkout_session.payment_paid',
      'checkout_session.paid',
      'payment.paid',
    ].includes(eventType);

    if (isCheckoutPaid) {
      const sessionResource =
        event.data?.attributes?.data ||
        event.data?.data ||
        event.data;
      const sessionAttrs = sessionResource?.attributes || sessionResource || {};
      const sessionId = sessionResource?.id || null;
      const saleId = sessionAttrs?.metadata?.saleId;

      if (saleId) {
        let finalized = false;
        await sequelize.transaction(async (t) => {
          const sale = await Sale.findByPk(saleId, { transaction: t, lock: true });
          if (sale && sale.paymentStatus !== 'paid') {
            await sale.update({ paymentStatus: 'paid', status: 'completed', paymentReference: sessionId || '' }, { transaction: t });

            const existingPayment = await Payment.findOne({ where: { saleId: sale.id }, transaction: t });
            if (existingPayment) {
              await existingPayment.update({ status: 'completed', reference: sessionId || '', paidAt: new Date() }, { transaction: t });
            } else {
              await Payment.create({
                saleId: sale.id,
                amount: sale.total,
                paymentMethod: sale.paymentMethod,
                reference: sessionId || '',
                status: 'completed',
                paidAt: new Date(),
              }, { transaction: t });
            }

            await saleService.finalizeAfterPayment(sale.id, t, { source: 'PayMongo webhook' });
            finalized = true;
          }
        });

        if (finalized) {
          console.log(`PayMongo webhook: Sale ${saleId} marked as paid`);
          await saleService.emailReceiptForSale(saleId);
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    res.status(500).json({ received: false, error: 'Processing error' });
  }
});

module.exports = router;
module.exports.resolvePublicOrigin = resolvePublicOrigin;
