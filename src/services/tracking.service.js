const { Delivery, RiderLocation, Purchase, PettyCashFund } = require('../models');
const ApiError = require('../utils/ApiError');
const purchaseService = require('./purchase.service');

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2 - lat1) * Math.PI/180;
  const Δλ = (lon2 - lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

class TrackingService {
  async createDelivery(data) {
    return Delivery.create(data);
  }

  async getDelivery(deliveryId) {
    return Delivery.findByPk(deliveryId);
  }

  async getLatestLocation(deliveryId) {
    return RiderLocation.findOne({ where: { deliveryId }, order: [['createdAt', 'DESC']] });
  }

  async shipPurchase(purchaseId, { destinationLat, destinationLng, riderId }) {
    const purchase = await Purchase.findByPk(purchaseId);
    if (!purchase) throw ApiError.notFound('Purchase not found');

    const existing = await Delivery.findOne({ where: { orderId: purchaseId, orderType: 'purchase' } });
    if (existing && existing.status !== 'cancelled') throw ApiError.badRequest('Delivery already exists for this purchase');

    const delivery = await Delivery.create({
      orderType: 'purchase',
      orderId: purchaseId,
      supplierId: purchase.supplierId,
      riderId: riderId || 'rider-1',
      destinationLat,
      destinationLng,
      status: 'pending',
    });

    return delivery;
  }

  async updateLocation({ deliveryId, riderId, lat, lng }) {
    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
      throw ApiError.badRequest('Invalid coordinates');
    }

    const loc = await RiderLocation.create({ deliveryId, riderId, lat: numLat, lng: numLng });

    try {
      const delivery = await Delivery.findByPk(deliveryId);
      if (delivery && delivery.destinationLat && delivery.destinationLng) {
        const dist = haversine(numLat, numLng, parseFloat(delivery.destinationLat), parseFloat(delivery.destinationLng));

        if (dist < 100) {
          if (delivery.status !== 'delivered') {
            await delivery.update({ status: 'delivered' });

            if (delivery.orderType === 'purchase') {
              const purchase = await Purchase.findByPk(delivery.orderId);
              if (purchase && purchase.status !== 'received') {
                try {
                  await purchaseService.receive(delivery.orderId, {
                    items: Array.isArray(purchase.items) ? purchase.items.map(i => ({ productId: i.productId, quantity: i.quantity })) : []
                  }, riderId);
                  const total = parseFloat(purchase.total) || 0;
                  if (total > 0) {
                    const fund = await PettyCashFund.findOne({ where: { isActive: true } });
                    if (fund) {
                      await fund.update({ currentBalance: parseFloat(fund.currentBalance) - total });
                    }
                  }
                } catch (e) {
                  console.error('Auto-receive failed:', e.message);
                }
              }
            }

            try {
              const io = require('../server').io;
              if (io) io.to(String(deliveryId)).emit('status', { deliveryId, status: 'delivered' });
            } catch {}
          }
        } else if (dist < 5000) {
          if (delivery.status === 'pending') {
            await delivery.update({ status: 'in_transit' });
            try {
              const io = require('../server').io;
              if (io) io.to(String(deliveryId)).emit('status', { deliveryId, status: 'in_transit' });
            } catch {}
          }
        }
      }
    } catch (e) {
      console.error('Auto-receive error:', e.message);
    }

    return loc;
  }
}

module.exports = new TrackingService();
