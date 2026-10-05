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
      // Field allow-listing lives in two places and stays consistent on its
      // own: the Joi updateSettings schema (stripUnknown) and the service's
      // ALLOWED_KEYS. A third list here previously dropped new fields
      // (allowPublicRegistration) silently.
      const settings = await settingService.update(req.body);
      sendSuccess(res, settings, 'Settings updated successfully');
    } catch (err) { next(err); }
  }
}

module.exports = new SettingController();
