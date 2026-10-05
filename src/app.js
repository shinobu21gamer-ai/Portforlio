const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const cron = require('node-cron');

const config = require('./config');
const { connectDB } = require('./config/database');
const routes = require('./routes');
const { errorHandler, requestIdMiddleware } = require('./middleware/errorHandler');
const specs = require('./docs/swagger');
const { protect, authorize } = require('./middleware/auth');

const app = express();

// Trust the first proxy hop only in production (Render/nginx sit in front).
// Unconditional trust on a bare VPS would let clients spoof X-Forwarded-* headers.
app.set('trust proxy', config.nodeEnv === 'production' ? 1 : false);

// Response compression — without this every JS/CSS/JSON payload went out
// uncompressed (~3x the wire size of the hashed bundles).
app.use(compression());

// â”€â”€â”€ Security Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://unpkg.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://unpkg.com', 'https://*.tile.openstreetmap.org'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'sameorigin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// CORS policy (single-origin by default):
//   • CORS_ORIGIN unset  → same-origin only (correct for the standard one-host
//     Render/Docker deploy where API + both frontends share the domain).
//   • CORS_ORIGIN set    → the listed origins are additionally allowed.
//   • CORS_ORIGIN=*      → allow any origin, NO credentials (cookie-less).
//     Browsers reject wildcard + credentials anyway; this mode is for API-only
//     consumers such as the standalone Vercel frontend builds.
const corsConfigured = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : [];
const corsAllowAny = corsConfigured.includes('*');
const allowedOrigins = corsConfigured.filter((o) => o !== '*');
if (corsAllowAny) {
  console.warn('[CORS] CORS_ORIGIN=* — allowing any cross-origin origin without credentials. Only use for API-only consumers.');
}
if (config.nodeEnv === 'production' && !corsAllowAny) {
  const origins = allowedOrigins.length > 0
    ? allowedOrigins
    : ['(same-origin only — set CORS_ORIGIN to add more)'];
  console.log(`[CORS] Allowed cross-origin hosts: ${origins.join(', ')}`);
}

app.use((req, res, next) => {
  cors({
    origin: (origin, callback) => {
      // No Origin header = same-origin or non-browser client.
      if (!origin) return callback(null, true);
      if (corsAllowAny) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Single-app deployment: always allow same-origin requests.
      try {
        if (new URL(origin).host === (req.headers.host || '')) return callback(null, true);
      } catch (e) { /* invalid origin header */ }
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Wildcard + credentials is invalid per spec; never send credentials there.
    credentials: !corsAllowAny,
  })(req, res, next);
});

app.use(cookieParser());

const server = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: true, credentials: true } });

// ── Socket authentication ─────────────────────────────────
// Connections must present a valid access token (handshake.auth.token or the
// session cookie). Unauthenticated sockets are dropped; room joins are then
// further restricted by role so a random login cannot track any delivery.
const jwt = require('jsonwebtoken');
const { User } = require('./models');
const TRACKING_ROLES = ['admin', 'manager', 'inventory_staff'];

io.use(async (socket, next) => {
  try {
    let token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token && socket.handshake.headers.cookie) {
      const match = socket.handshake.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/);
      token = match && decodeURIComponent(match[1]);
    }
    if (!token) return next(new Error('unauthorized'));

    const blacklisted = (await require('./services/auth.service').isTokenBlacklisted(token));
    if (blacklisted) return next(new Error('unauthorized'));

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (e) {
      return next(new Error('unauthorized'));
    }
    const user = await User.findByPk(decoded.id, {
      include: [{ association: 'role', attributes: ['id', 'slug'] }],
    });
    if (!user || !user.isActive) return next(new Error('unauthorized'));
    socket.data.user = { id: user.id, role: user.role ? user.role.slug : null };
    next();
  } catch (e) {
    console.error('[SOCKET] auth check failed:', e.message);
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  const role = socket.data.user && socket.data.user.role;
  socket.on('join-delivery', (id) => {
    if (!TRACKING_ROLES.includes(role)) {
      socket.emit('forbidden', { error: 'You do not have access to delivery tracking' });
      return;
    }
    socket.join(String(id));
  });
});

// â”€â”€â”€ Rate Limiting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const isDev = config.nodeEnv === 'development';
// 200 req/15min used to trip on a single busy terminal: payment-status
// polling (~1 req/3s) plus page loads could exhaust it mid-shift and lock a
// real cashier out. 2,000/15min still caps abusive bursts (≈2.2 req/s).
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 9999 : 2000,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Polling endpoints get their own, higher budget so the global limit can't
// starve a terminal waiting on a PayMongo confirmation.
const pollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 9999 : 1000,
  // Outbound PayMongo webhooks share this prefix but are low-volume system
  // traffic, not client polling — never rate-limit them here.
  skip: (req) => req.path === '/webhook',
  message: { success: false, message: 'Polling too frequently, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/payments', pollLimiter);
app.use('/api/v1/notifications', pollLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 9999 : 20,
  message: { success: false, message: 'Too many attempts, please try again later.' },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 100 : 5,
  message: { success: false, message: 'Too many registration attempts. Please try again later.' },
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', registerLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
app.use('/api/v1/auth/reset-password', authLimiter);
app.use('/api/v1/auth/refresh-token', rateLimit({ windowMs: 15 * 60 * 1000, max: isDev ? 9999 : 30, message: { success: false, message: 'Too many token refresh attempts.' } }));

// â”€â”€â”€ Body Parsing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// â”€â”€â”€ Logging â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: { write: (message) => console.log(message.trim()) } }));
}

// â”€â”€â”€ Static Files â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Only product images (under uploads/products) are served publicly.
// Private HR files (uploads/resumes, uploads/documents, uploads/products/resumes)
// must be retrieved through authenticated API routes.
const uploadsRoot = path.join(__dirname, '..', 'uploads');
const PRIVATE_UPLOAD_SEGMENTS = ['resumes', 'documents', 'hr'];
app.use('/uploads/products', (req, res, next) => {
  const seg = (req.path.split('/').filter(Boolean)[0] || '').toLowerCase();
  if (PRIVATE_UPLOAD_SEGMENTS.includes(seg)) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  next();
}, express.static(path.join(uploadsRoot, 'products'), { dotfiles: 'deny', index: false }));

// â”€â”€â”€ Request ID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(requestIdMiddleware);

// â”€â”€â”€ API Documentation (protected in production) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if (config.nodeEnv === 'production') {
  const { authorize } = require('./middleware/auth');
  app.use('/api-docs', protect, authorize('admin'), swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'MiniMart POS API Docs',
  }));
} else {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'MiniMart POS API Docs',
  }));
}

// â”€â”€â”€ Health Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'MiniMart POS API is running', timestamp: new Date().toISOString() });
});

// â”€â”€â”€ Prometheus Metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const startTime = Date.now();
let requestCount = 0;

// â”€â”€â”€ Metrics Endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/metrics', protect, authorize('admin'), (req, res) => {
  const mem = process.memoryUsage();
  const uptime = process.uptime();
  const metrics = [
    '# HELP app_uptime_seconds Application uptime in seconds',
    '# TYPE app_uptime_seconds gauge',
    `app_uptime_seconds ${uptime.toFixed(2)}`,
    '# HELP app_memory_rss_bytes Resident set size in bytes',
    '# TYPE app_memory_rss_bytes gauge',
    `app_memory_rss_bytes ${mem.rss}`,
    '# HELP app_memory_heap_used_bytes Heap used in bytes',
    '# TYPE app_memory_heap_used_bytes gauge',
    `app_memory_heap_used_bytes ${mem.heapUsed}`,
    '# HELP app_memory_heap_total_bytes Heap total in bytes',
    '# TYPE app_memory_heap_total_bytes gauge',
    `app_memory_heap_total_bytes ${mem.heapTotal}`,
    '# HELP app_cpu_user_seconds User CPU time in seconds',
    '# TYPE app_cpu_user_seconds gauge',
    `app_cpu_user_seconds ${(process.cpuUsage().user / 1e6).toFixed(2)}`,
    '# HELP app_cpu_system_seconds System CPU time in seconds',
    '# TYPE app_cpu_system_seconds gauge',
    `app_cpu_system_seconds ${(process.cpuUsage().system / 1e6).toFixed(2)}`,
    '# HELP app_node_version Node.js version',
    '# TYPE app_node_version gauge',
    `app_node_version{version="${process.version}"} 1`,
    '# HELP app_requests_total Total HTTP requests (since start)',
    '# TYPE app_requests_total counter',
    `app_requests_total ${requestCount}`,
  ].join('\n');
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics);
});

app.use((req, res, next) => { requestCount++; next(); });

// â”€â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(routes);

// Redirect root to Job Portal (landing page)
app.get('/', (req, res) => {
  res.redirect('/hrms/careers');
});

// â”€â”€â”€ HRMS Frontend Static Files (served at /hrms) â”€â”€â”€â”€â”€â”€â”€â”€â”€
const hrmsDist = path.join(__dirname, '..', 'frontend-hrms', 'dist');
if (fs.existsSync(hrmsDist)) {
  app.use('/hrms/assets', express.static(path.join(hrmsDist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use('/hrms', express.static(hrmsDist, { index: 'index.html' }));
  app.get('/hrms/*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) return next();
    if (path.extname(req.path)) return res.status(404).send('Not found');
    res.sendFile(path.join(hrmsDist, 'index.html'), { headers: { 'Cache-Control': 'no-store, must-revalidate' } }, (err) => { if (err) next(); });
  });
  console.log('HRMS frontend served at /hrms');
} else {
  console.warn('HRMS frontend dist not found â€” skipping /hrms');
}

// â”€â”€â”€ POS Frontend Static Files (served at /) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use('/assets', express.static(path.join(frontendDist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(frontendDist, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads') || req.originalUrl.startsWith('/api-docs') || req.originalUrl.startsWith('/health')) {
      return next();
    }
    if (path.extname(req.path)) return res.status(404).send('Not found');
    res.sendFile(path.join(frontendDist, 'index.html'), { headers: { 'Cache-Control': 'no-store, must-revalidate' } }, (err) => {
      if (err) next();
    });
  });
} else {
  console.warn('Frontend dist not found â€” running API-only mode.');
}

// â”€â”€â”€ 404 Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// â”€â”€â”€ Error Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.use(errorHandler);

module.exports = { app, io, server };
