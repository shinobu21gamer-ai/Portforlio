const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isDev = (process.env.NODE_ENV || 'development') === 'development';
const isProd = process.env.NODE_ENV === 'production';

const errors = [];

const fs = require('fs');

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

if (isProd) {
  const dbDialect = process.env.DB_DIALECT || 'sqlite';
  if (dbDialect === 'mysql') {
    if (!process.env.DB_HOST) errors.push('DB_HOST is required in production (mysql)');
    if (!process.env.DB_NAME) errors.push('DB_NAME is required in production (mysql)');
    if (!process.env.DB_USER) errors.push('DB_USER is required in production (mysql)');
    if (!process.env.DB_PASSWORD) errors.push('DB_PASSWORD is required in production (mysql)');
  }
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

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiPrefix: process.env.API_PREFIX || '/api/v1',
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
    path: process.env.UPLOAD_PATH || 'uploads/products',
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM,
  },
  app: {
    name: process.env.APP_NAME || 'MiniMart POS',
    currency: process.env.DEFAULT_CURRENCY || 'PHP',
    taxRate: parseFloat(process.env.TAX_RATE) || 0.12,
    lowStockThreshold: parseInt(process.env.LOW_STOCK_THRESHOLD, 10) || 10,
    expiryWarningDays: parseInt(process.env.EXPIRY_WARNING_DAYS, 10) || 30,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
    posFrontendUrl: process.env.POS_FRONTEND_URL || 'http://localhost:5173',
  },
  paymongo: {
    secretKey: process.env.PAYMONGO_SECRET_KEY,
    publicKey: process.env.PAYMONGO_PUBLIC_KEY,
    webhookSecret: process.env.PAYMONGO_WEBHOOK_SECRET,
  },
};
