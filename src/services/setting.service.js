const fs = require('fs');
const path = require('path');
const config = require('../config');
const storage = require('../utils/storage');
const ApiError = require('../utils/ApiError');

// Runtime settings live in data/settings.json by default, which is
// gitignored (it is rewritten by the settings API). In production point
// SETTINGS_FILE at the persistent volume (e.g. /data/settings.json).
// data/settings.defaults.json is the committed dev/demo baseline and is
// only used to seed the runtime file's first read.
const DEFAULT_SETTINGS_FILE = path.resolve(__dirname, '../../data/settings.json');
// An unwritable SETTINGS_FILE (missing/read-only volume) must not lose the
// settings silently: resolveWritableFile falls back to the app's data/ dir and
// logs a [STORAGE] warning instead. Writes were already best-effort below.
const SETTINGS_FILE = process.env.SETTINGS_FILE
  ? storage.resolveWritableFile(process.env.SETTINGS_FILE, {
      label: 'settings file',
      fallbacks: [DEFAULT_SETTINGS_FILE, path.join(storage.TMP_ROOT, 'settings.json')],
    })
  : DEFAULT_SETTINGS_FILE;
const SETTINGS_DEFAULTS_FILE = path.resolve(__dirname, '../../data/settings.defaults.json');

const DEFAULT_KEYS = ['storeName', 'storeAddress', 'storePhone', 'storeEmail', 'taxRate', 'currency', 'lowStockThreshold', 'receiptHeader', 'receiptFooter'];
const ALLOWED_KEYS = new Set([...DEFAULT_KEYS, 'address', 'phone', 'email', 'gcashNumber', 'mayaNumber', 'allowPublicRegistration', 'onboardingDismissedAt']);

// The UI historically wrote `storeAddress` / `storePhone` / `storeEmail` while
// every consumer (public landing payload, receipt model, HRMS notices) reads
// `address` / `phone` / `email`. Those alias keys are kept in the allowed list
// for stored files and older clients, but are normalised onto the canonical keys
// on read and on write so a saved value can never be stranded.
const KEY_ALIASES = { storeAddress: 'address', storePhone: 'phone', storeEmail: 'email' };

const normaliseKeys = (obj, { preferCanonical = true } = {}) => {
  const out = { ...obj };
  for (const [alias, canonical] of Object.entries(KEY_ALIASES)) {
    if (out[alias] === undefined) continue;
    // On a read, an empty canonical value falls back to the stored alias. On a
    // write, the payload's alias must win over whatever is already stored — the
    // sender never sees the current value, so "only fill when missing" would
    // silently discard an update to an already-populated field.
    const canonicalSent = out[canonical] !== undefined;
    const canonicalFilled = canonicalSent && String(out[canonical]).trim() !== '';
    if (preferCanonical ? !canonicalFilled : !canonicalSent) {
      if (String(out[alias] ?? '').trim() !== '' || !canonicalSent) out[canonical] = out[alias];
    }
    delete out[alias];
  }
  return out;
};

const DEFAULTS = {
  storeName: config.app.name || 'My Store',
  receiptHeader: '',
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
    // Prefer the runtime file; fall back to the committed dev/demo baseline
    // so a fresh production volume still boots with sensible defaults.
    for (const file of [SETTINGS_FILE, SETTINGS_DEFAULTS_FILE]) {
      if (!fs.existsSync(file)) continue;
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      settings = normaliseKeys({ ...DEFAULTS, ...filterAllowed(saved) });
      return;
    }
  } catch {
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
  } catch {
    // silent fail — in-memory still works
  }
};

loadFromFile();

class SettingService {
  async get() {
    // normaliseKeys is idempotent and cheap; it also repairs a file that was
    // written by an older build using only the alias keys.
    // `publicRegistrationEffective` is what actually gates the register API
    // (env override + setting + environment default), so the UI can display
    // the true state even when env forces it.
    return normaliseKeys({ ...settings, publicRegistrationEffective: this.isPublicRegistrationAllowed() });
  }

  async update(data) {
    // preferCanonical=false: an alias the client sent is an update, not a fallback.
    const filtered = normaliseKeys(filterAllowed(data), { preferCanonical: false });

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

    // First-run checklist dismissal timestamp (ISO string or null to re-show).
    if ('onboardingDismissedAt' in filtered) {
      const v = filtered.onboardingDismissedAt;
      filtered.onboardingDismissedAt = v === null || v === '' ? null : String(v);
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
