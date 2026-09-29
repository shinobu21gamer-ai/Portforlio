const fs = require('fs');
const path = require('path');
const pino = require('pino');

const isDev = (process.env.NODE_ENV || 'development') === 'development';
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logFile = path.join(logDir, 'app.log');
const errorLogFile = path.join(logDir, 'error.log');

let logger;

if (isDev) {
  const { format } = require('util');
  const appendToFile = (file, message) => {
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${message}\n`, 'utf-8');
  };
  logger = {
    info: (...args) => { const m = format(...args); console.log(`[INFO] ${m}`); appendToFile(logFile, `[INFO] ${m}`); },
    warn: (...args) => { const m = format(...args); console.warn(`[WARN] ${m}`); appendToFile(logFile, `[WARN] ${m}`); },
    error: (...args) => { const m = format(...args); console.error(`[ERROR] ${m}`); appendToFile(logFile, `[ERROR] ${m}`); appendToFile(errorLogFile, `[ERROR] ${m}`); },
    debug: (...args) => { const m = format(...args); console.debug(`[DEBUG] ${m}`); appendToFile(logFile, `[DEBUG] ${m}`); },
  };
} else {
  const fileStream = pino.destination({ dest: logFile, sync: false });
  const errorStream = pino.destination({ dest: errorLogFile, sync: false });

  const baseLogger = pino({
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  }, fileStream);

  const errorLogger = pino({
    level: 'error',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  }, errorStream);

  logger = {
    info: (msg, ...args) => baseLogger.info(args.length ? { extra: args } : {}, msg),
    warn: (msg, ...args) => baseLogger.warn(args.length ? { extra: args } : {}, msg),
    error: (msg, ...args) => {
      baseLogger.error(args.length ? { extra: args } : {}, msg);
      errorLogger.error(args.length ? { extra: args } : {}, msg);
    },
    debug: (msg, ...args) => baseLogger.debug(args.length ? { extra: args } : {}, msg),
    pino: baseLogger,
  };
}

module.exports = logger;
