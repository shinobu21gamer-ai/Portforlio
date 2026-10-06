const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isDev = (process.env.NODE_ENV || 'development') === 'development';
const isProd = process.env.NODE_ENV === 'production';

const errors = [];

const fs = require('fs');
const storage = require('../utils/storage');

const getOrCreateDevSecret = (secretName, envVar) => {
  if (process.env[envVar]) return process.env[envVar];
  if (!isDev) return null;

  const secretFile = path.resolve(__dirname, '..', '..', '.dev-secrets.json');
  let secrets = {};
  try {
    if (fs.existsSync(secretFile)) {
      secrets = JSON.parse(fs.readFileSync(secretFile, 'utf8'));
    }
  } catch { /* ignore */ }

  if (!secrets[secretName]) {
    secrets[secretName] = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(secretFile, JSON.stringify(secrets, null, 2));
    } catch { /* ignore */ }
  }
  return secrets[secretName];
};

if (!process.env.JWT_SECRET) {
  const devSecret = getOrCreateDevSecret('jwt_secret', 'JWT_SECRET');
  if (devSecret) {
    process.env.JWT_SECRET = devSecret;
    console.warn('[CONFIG] Using persistent dev JWT_SECRET from .dev-secrets.json');
  } else if (isProd) {
    errors.push('JWT_SECRET is required in production');
  }
} else if (isProd && /^your_|^change_me/.test(process.env.JWT_SECRET)) {
  errors.push('JWT_SECRET appears to be a placeholder. Generate a real secret: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

if (!process.env.JWT_REFRESH_SECRET) {
  const devSecret = getOrCreateDevSecret('jwt_refresh_secret', 'JWT_REFRESH_SECRET');
  if (devSecret) {
    process.env.JWT_REFRESH_SECRET = devSecret;
    console.warn('[CONFIG] Using persistent dev JWT_REFRESH_SECRET from .dev-secrets.json');
  } else if (isProd) {
    errors.push('JWT_REFRESH_SECRET is required in production');
  }
} else if (isProd && /^your_|^change_me/.test(process.env.JWT_REFRESH_SECRET)) {
  errors.push('JWT_REFRESH_SECRET appears to be a placeholder. Generate a real secret.');
}

// Single source of truth for the database dialect. Everything (database.js,
// server.js) must read config.dbDialect so the defaults can never diverge.
// SQLite is the documented default: `npm start` must work with zero env vars.
const SUPPORTED_DIALECTS = ['sqlite', 'mysql'];
const dbDialect = (process.env.DB_DIALECT || 'sqlite').toLowerCase();
if (!SUPPORTED_DIALECTS.includes(dbDialect)) {
  errors.push(`DB_DIALECT must be one of: ${SUPPORTED_DIALECTS.join(', ')} (got "${process.env.DB_DIALECT}")`);
}

if (isProd && dbDialect === 'mysql') {
  if (!process.env.DB_HOST) errors.push('DB_HOST is required in production (mysql)');
  if (!process.env.DB_NAME) errors.push('DB_NAME is required in production (mysql)');
  if (!process.env.DB_USER) errors.push('DB_USER is required in production (mysql)');
  if (!process.env.DB_PASSWORD) errors.push('DB_PASSWORD is required in production (mysql)');
}

// Email is used for password resets, payslips, receipts and contract/notice
// mails. In production an unconfigured mailer used to drop every message
// silently, so fail boot unless the operator either configures SMTP or
// explicitly opts out of outbound email.
if (isProd && !process.env.SMTP_HOST && process.env.EMAIL_DISABLED !== 'true') {
  errors.push('SMTP_HOST is required in production (set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/EMAIL_FROM) — or set EMAIL_DISABLED=true to explicitly run without outbound email');
}

if (errors.length > 0) {
  console.error('[CONFIG] Configuration errors:');
  errors.forEach(e => console.error(`  - ${e}`));
  if (isProd) {
    process.exit(1);
  } else {
    console.warn('[CONFIG] Continuing in development mode despite errors.');
  }
}

// ─── Uploads ───────────────────────────────────────────────────────────
// Resolved through src/utils/storage so an unwritable or not-yet-mounted
// volume degrades to a working (ephemeral) location with a loud [STORAGE]
// warning instead of killing the process at require time. The old
// mkdirSync() in src/middleware/upload.js did exactly that on Render free
// instances — where UPLOAD_DIR=/data/uploads is set but persistent disks
// cannot be attached — so the server died with EACCES before binding a port.
const uploadBase = storage.resolveWritableDir(process.env.UPLOAD_DIR || 'uploads', {
  label: 'uploads directory',
  level: process.env.UPLOAD_DIR ? 'warn' : 'log',
  fallbacks: [
    path.resolve('uploads'),
    path.join(storage.APP_ROOT, 'uploads'),
    path.join(storage.TMP_ROOT, 'uploads'),
  ],
});
const uploadPath = storage.resolveWritableDir(process.env.UPLOAD_PATH || path.join(uploadBase, 'products'), {
  label: 'product image directory',
  level: process.env.UPLOAD_PATH ? 'warn' : 'log',
  fallbacks: [
    path.join(uploadBase, 'products'),
    path.join(storage.APP_ROOT, 'uploads', 'products'),
    path.join(storage.TMP_ROOT, 'uploads', 'products'),
  ],
});

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  dbDialect,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5242880,
    // Base uploads directory. In production point this at the persistent
    // mount (e.g. /data/uploads on Render) so uploads survive redeploys.
    // Both values are absolute and were verified writable at boot; if the
    // configured location was not usable they point at a fallback that was
    // (see src/utils/storage.js and the [STORAGE] warning in the logs).
    base: uploadBase,
    path: uploadPath,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM,
    // EMAIL_DISABLED=true only relaxes the production boot guard above. It is
    // NOT a switch that turns sending off (sending is enabled purely by
    // SMTP_HOST/SMTP_USER) — that confusion is expensive to debug, so the
    // admin email-status endpoint reports the flag explicitly.
    disabled: process.env.EMAIL_DISABLED === 'true',
  },
  app: {
    name: process.env.APP_NAME || 'MiniMart POS',
    currency: process.env.DEFAULT_CURRENCY || 'PHP',
    // Business timezone for day/month boundaries in reports, dashboards and
    // cron windows. Stored timestamps are UTC; everything "today"-ish is
    // computed in this zone (see src/utils/timezone.js).
    timezone: process.env.APP_TIMEZONE || 'Asia/Manila',
    taxRate: parseFloat(process.env.TAX_RATE) || 0.12,
    lowStockThreshold: parseInt(process.env.LOW_STOCK_THRESHOLD, 10) || 10,
    expiryWarningDays: parseInt(process.env.EXPIRY_WARNING_DAYS, 10) || 30,
    // Both left null when unset: callers fall back to the incoming request origin.
    // A localhost default here silently puts dead localhost links inside every
    // outbound email (reset, payslip, contract, applicant status) in production.
    frontendUrl: process.env.FRONTEND_URL || null,
    posFrontendUrl: process.env.POS_FRONTEND_URL || null,
    // HRMS is served under /hrms on the same origin as the API.
    hrmsBasePath: process.env.HRMS_BASE_PATH || '/hrms',
  },
  paymongo: {
    secretKey: process.env.PAYMONGO_SECRET_KEY,
    publicKey: process.env.PAYMONGO_PUBLIC_KEY,
    webhookSecret: process.env.PAYMONGO_WEBHOOK_SECRET,
  },
};
