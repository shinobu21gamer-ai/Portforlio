const axios = require('axios');
const ApiError = require('../utils/ApiError');
const config = require('../config');

const PAYMONGO_BASE = 'https://api.paymongo.com/v1';

function getAuthHeader() {
  const key = config.paymongo.secretKey;
  if (!key || key === 'sk_test_your_key_here') return null;
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64');
}

function isConfigured() {
  return !!getAuthHeader();
}

async function createPaymentIntent({ amount, description, metadata = {} }) {
  const auth = getAuthHeader();
  if (!auth) throw ApiError.serviceUnavailable('Online payments are not configured. Ask an admin to set PAYMONGO_SECRET_KEY.');

  const res = await axios.post(`${PAYMONGO_BASE}/payment_intents`, {
    data: {
      attributes: {
        amount: Math.round(amount * 100),
        currency: 'PHP',
        description,
        metadata,
      },
    },
  }, {
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
  });

  return res.data.data;
}

async function createCheckoutSession({ amount, description, lineItems = [], paymentMethodTypes = ['gcash', 'paymaya', 'card'], metadata = {}, successUrl, cancelUrl }) {
  const auth = getAuthHeader();
  if (!auth) throw ApiError.serviceUnavailable('Online payments are not configured. Ask an admin to set PAYMONGO_SECRET_KEY.');

  const formattedItems = lineItems.length > 0 ? lineItems.map(item => ({
    currency: 'PHP',
    amount: Math.round((item.amount || 0) * 100),
    quantity: item.quantity || 1,
    name: item.name,
    description: item.description || '',
  })) : [{
    currency: 'PHP',
    amount: Math.round(amount * 100),
    quantity: 1,
    name: description || 'Payment',
    description: description || '',
  }];

  console.log('PayMongo checkout request:', { amount, lineItemsCount: formattedItems.length, successUrl, cancelUrl });

  const res = await axios.post(`${PAYMONGO_BASE}/checkout_sessions`, {
    data: {
      attributes: {
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        line_items: formattedItems,
        payment_method_types: paymentMethodTypes,
        success_url: successUrl,
        cancel_url: cancelUrl,
        description,
        metadata,
      },
    },
  }, {
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
  });

  return res.data.data;
}

async function retrieveCheckoutSession(sessionId) {
  const auth = getAuthHeader();
  if (!auth) throw ApiError.serviceUnavailable('Online payments are not configured.');

  const res = await axios.get(`${PAYMONGO_BASE}/checkout_sessions/${sessionId}`, {
    headers: { Authorization: auth },
  });

  return res.data.data;
}

async function retrievePaymentIntent(id) {
  const auth = getAuthHeader();
  if (!auth) throw ApiError.serviceUnavailable('Online payments are not configured.');

  const res = await axios.get(`${PAYMONGO_BASE}/payment_intents/${id}`, {
    headers: { Authorization: auth },
  });

  return res.data.data;
}

function verifyWebhookSignature(body, signature, rawBody) {
  const crypto = require('crypto');
  const webhookSecret = config.paymongo.webhookSecret;

  if (!webhookSecret || webhookSecret.includes('your_webhook')) {
    if (process.env.NODE_ENV === 'production') {
      console.error('PayMongo webhook secret not configured — rejecting webhook in production');
      return false;
    }
    console.warn('PayMongo webhook secret not configured in dev — skipping signature verification');
    return true;
  }

  if (!signature) return false;

  try {
    const parts = {};
    signature.split(',').forEach((part) => {
      const [k, v] = part.split('=');
      parts[k.trim()] = v.trim();
    });

    const timestamp = parts.t;
    const receivedSig = parts.v1;

    if (!timestamp || !receivedSig) return false;

    const now = Date.now() / 1000;
    if (Math.abs(now - parseFloat(timestamp)) > 300) {
      console.warn('PayMongo webhook signature timestamp is stale — rejecting');
      return false;
    }

    const payload = rawBody ? rawBody.toString('utf8') : JSON.stringify(body);
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');

    const receivedBuf = Buffer.from(receivedSig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (receivedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(receivedBuf, expectedBuf);
  } catch (e) {
    console.error('Webhook signature verification failed:', e.message);
    return false;
  }
}

module.exports = {
  isConfigured,
  createPaymentIntent,
  createCheckoutSession,
  retrieveCheckoutSession,
  retrievePaymentIntent,
  verifyWebhookSignature,
};
