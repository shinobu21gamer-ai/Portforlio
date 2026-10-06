const { Sequelize } = require('sequelize');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Dialect default lives in src/config (SQLite) — a bare `npm start` must work
// without any env vars. Reading process.env here with a different default
// previously made fresh deploys crash with "Unable to connect to the database".
const config = require('./index');
const storage = require('../utils/storage');
const isSQLite = config.dbDialect === 'sqlite';

// ':memory:' must be passed through untouched. path.resolve() would turn it
// into a real file named ':memory:', which silently leaks to disk and lets
// separate connections miss each other's tables.
//
// Belt-and-braces for tests: if NODE_ENV is test but DB_STORAGE was not
// explicitly pointed at an in-memory database (e.g. a test file that
// requires src before its env setup runs), fall back to ':memory:' instead
// of the real data file. Test suites call sync({ force: true }) — pointed
// at the real database that is a data wipe.
const envDbStorage = process.env.DB_STORAGE;
// Same tiering as the uploads directory: an unwritable volume (missing disk on
// Render free, root-owned Docker volume) must not crash the boot. A file that
// already exists is never silently replaced by a different one — see
// src/utils/storage.js.
const resolveSqliteFile = (filePath) => {
  const resolved = storage.resolveWritableFile(path.resolve(storage.APP_ROOT, filePath), {
    label: 'SQLite database file',
    fallbacks: [
      path.join(storage.APP_ROOT, 'database.sqlite'),
      path.join(storage.TMP_ROOT, 'database.sqlite'),
    ],
  });
  console.log(`[STORAGE] SQLite database file: ${resolved}`);
  return resolved;
};

let sqliteStorage;
if (envDbStorage === ':memory:') {
  sqliteStorage = ':memory:';
} else if (envDbStorage) {
  sqliteStorage = resolveSqliteFile(envDbStorage);
} else if (process.env.NODE_ENV === 'test') {
  sqliteStorage = ':memory:';
} else {
  sqliteStorage = resolveSqliteFile('./database.sqlite');
}

const sequelize = isSQLite
  ? new Sequelize({
      dialect: 'sqlite',
      storage: sqliteStorage,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      define: {
        timestamps: true,
        underscored: true,
        paranoid: true,
      },
      dialectOptions: {
        // Enable WAL mode for better concurrency and set busy timeout
        pragma: {
          journal_mode: 'WAL',
          busy_timeout: 5000,
          synchronous: 'NORMAL',
        },
      },
      retry: {
        match: [/SQLITE_BUSY/, /SQLITE_LOCKED/],
        max: 3,
      },
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: config.dbDialect,
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
        define: {
          timestamps: true,
          underscored: true,
          paranoid: true,
          charset: 'utf8mb4',
          collate: 'utf8mb4_unicode_ci',
        },
        timezone: '+08:00',
      }
    );

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(`Database connected successfully (${isSQLite ? 'SQLite' : 'MySQL'}).`);
  } catch (error) {
    console.error('Unable to connect to the database:', error.message);
    // Turn the two classic volume misconfigurations into an actionable line
    // instead of a bare SQLITE_CANTOPEN in the deploy log.
    if (isSQLite && /SQLITE_CANTOPEN|SQLITE_READONLY|EACCES|EPERM|EROFS/i.test(error.message || '')) {
      console.error(
        `[STORAGE] SQLite could not open ${sqliteStorage}. Check that its directory exists and is writable by the ` +
        'user running the app (Docker: chown -R 1001:1001 <volume>; Render: a persistent disk is required there, ' +
        'and only paid instances can attach one).'
      );
    }
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB, Sequelize };
