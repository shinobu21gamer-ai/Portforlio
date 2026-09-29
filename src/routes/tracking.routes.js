const express = require('express');
const router = express.Router();
const trackingService = require('../services/tracking.service');
const { protect, authorize } = require('../middleware/auth');
const ApiError = require('../utils/ApiError');

router.post('/update', protect, authorize('admin', 'manager', 'inventory_staff'), async (req, res, next) => {
  try {
    const { deliveryId, lat, lng } = req.body;
    const riderId = req.user.id;
    const loc = await trackingService.updateLocation({ deliveryId, riderId, lat, lng });
    const io = require('../server').io || (global.io || null);
    if (io) io.to(String(deliveryId)).emit('location', { deliveryId, lat, lng, riderId });
    res.json({ success: true, data: loc });
  } catch (e) { next(e); }
});

router.get('/by-purchase/:purchaseId', protect, async (req, res, next) => {
  try {
    const { Delivery } = require('../models');
    const delivery = await Delivery.findOne({ where: { orderId: req.params.purchaseId, orderType: 'purchase' } });
    const location = delivery ? await trackingService.getLatestLocation(delivery.id) : null;
    res.json({ success: true, data: { delivery, location } });
  } catch (e) { next(e); }
});

router.get('/delivery/:deliveryId', protect, async (req, res, next) => {
  try {
    const delivery = await trackingService.getDelivery(req.params.deliveryId);
    const location = await trackingService.getLatestLocation(req.params.deliveryId);
    res.json({ success: true, data: { delivery, location } });
  } catch (e) { next(e); }
});

router.post('/ship/:purchaseId', protect, authorize('admin', 'manager', 'inventory_staff'), async (req, res, next) => {
  try {
    const { destinationLat, destinationLng } = req.body;
    const delivery = await trackingService.shipPurchase(req.params.purchaseId, { destinationLat, destinationLng, userId: req.user.id });
    res.json({ success: true, data: delivery, message: 'Delivery created' });
  } catch (e) { next(e); }
});

router.post('/simulate/:deliveryId', protect, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const { startLat, startLng } = req.body;
    const delivery = await require('../models').Delivery.findByPk(deliveryId);
    if (!delivery) throw ApiError.notFound('Delivery not found');
    const steps = 10;
    const sLat = parseFloat(startLat) || 14.5995;
    const sLng = parseFloat(startLng) || 120.9842;
    const eLat = parseFloat(delivery.destinationLat);
    const eLng = parseFloat(delivery.destinationLng);
    for (let i = 0; i <= steps; i++) {
      const lat = sLat + (eLat - sLat) * (i / steps);
      const lng = sLng + (eLng - sLng) * (i / steps);
      await trackingService.updateLocation({ deliveryId, riderId: 'simulator', lat, lng });
      const io = require('../server').io || (global.io || null);
      if (io) io.to(String(deliveryId)).emit('location', { deliveryId, lat, lng, status: delivery.status });
      await new Promise(r => setTimeout(r, 1000));
    }
    res.json({ success: true, message: 'Simulation complete' });
  } catch (e) { next(e); }
});

module.exports = router;
