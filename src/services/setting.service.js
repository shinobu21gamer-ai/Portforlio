const fs = require('fs');
const path = require('path');
const config = require('../config');
const ApiError = require('../utils/ApiError');

const SETTINGS_FILE = path.resolve(__dirname, '../../data/settings.json');

const DEFAULT_KEYS = ['storeName', 'storeAddress', 'storePhone', 'storeEmail', 'taxRate', 'currency', 'lowStockThreshold', 'receiptHeader', 'receiptFooter'];
const ALLOWED_KEYS = new Set([...DEFAULT_KEYS, 'address', 'phone', 'email', 'gcashNumber', 'mayaNumber', 'allowPublicRegistration']);

const DEFAULTS = {
  storeName: config.app.name || 'My Store',
  address: '',
  phone: '',
  email: '',
  taxRate: (config.app.taxRate || 0.12) * 100,
  lowStockThreshold: config.app.lowStockThreshold || 10,
  currency: config.app.currency || 'PHP',
  receiptFooter: 'Thank you for your purchase!',
  gcashNumber: '',
  mayaNumber: '',
};

let settings = { ...DEFAULTS };

const filterAllowed = (data) => {
  const filtered = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (ALLOWED_KEYS.has(key)) filtered[key] = value;
  }
  return filtered;
};

const loadFromFile = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const saved = JSON.parse(raw);
      settings = { ...DEFAULTS, ...filterAllowed(saved) };
    }
  } catch (e) {
    settings = { ...DEFAULTS };
  }
};

const saveToFile = () => {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmpFile = `${SETTINGS_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(settings, null, 2), 'utf8');
    fs.renameSync(tmpFile, SETTINGS_FILE);
  } catch (e) {
    // silent fail — in-memory still works
  }
};

loadFromFile();

class SettingService {
  async get() {
    // `publicRegistrationEffective` is what actually gates the register API
    // (env override + setting + environment default), so the UI can display
    // the true state even when env forces it.
    return { ...settings, publicRegistrationEffective: this.isPublicRegistrationAllowed() };
  }

  async update(data) {
    const filtered = filterAllowed(data);

    if ('taxRate' in filtered) {
      const taxRate = Number(filtered.taxRate);
      if (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
        throw ApiError.badRequest('taxRate must be a number between 0 and 100');
      }
      filtered.taxRate = taxRate;
    }

    if ('lowStockThreshold' in filtered) {
      const threshold = Number(filtered.lowStockThreshold);
      if (Number.isNaN(threshold) || threshold < 0) {
        throw ApiError.badRequest('lowStockThreshold must be a non-negative number');
      }
      filtered.lowStockThreshold = threshold;
    }

    if ('allowPublicRegistration' in filtered) {
      filtered.allowPublicRegistration = !!filtered.allowPublicRegistration;
    }

    settings = { ...settings, ...filtered };
    saveToFile();
    // Same shape as get() so clients always see publicRegistrationEffective.
    return this.get();
  }

  /**
   * Public self-registration gate (POST /api/v1/auth/register).
   * Precedence: explicit env ALLOW_PUBLIC_REGISTRATION > admin setting > default.
   * Default is OFF in production (a stranger-registered account is a live POS
   * login) and ON in development for convenience.
   */
  isPublicRegistrationAllowed() {
    const envFlag = (process.env.ALLOW_PUBLIC_REGISTRATION || '').toLowerCase();
    if (envFlag === 'true' || envFlag === '1') return true;
    if (envFlag === 'false' || envFlag === '0') return false;
    if (settings.allowPublicRegistration !== undefined) return !!settings.allowPublicRegistration;
    return config.nodeEnv !== 'production';
  }
}

module.exports = new SettingService();
