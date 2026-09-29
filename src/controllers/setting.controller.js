const settingService = require('../services/setting.service');
const { sendSuccess } = require('../utils/response');

class SettingController {
  async get(req, res, next) {
    try {
      const settings = await settingService.get();
      sendSuccess(res, settings);
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const allowedFields = ['storeName', 'storeAddress', 'storePhone', 'storeEmail', 'address', 'phone', 'email', 'taxRate', 'lowStockThreshold', 'currency', 'receiptHeader', 'receiptFooter', 'gcashNumber', 'mayaNumber'];
      const filtered = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) filtered[key] = req.body[key];
      }
      const settings = await settingService.update(filtered);
      sendSuccess(res, settings, 'Settings updated successfully');
    } catch (err) { next(err); }
  }
}

module.exports = new SettingController();
