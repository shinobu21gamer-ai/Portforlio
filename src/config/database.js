const { Sequelize } = require('sequelize');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Dialect default lives in src/config (SQLite) — a bare `npm start` must work
// without any env vars. Reading process.env here with a different default
// previously made fresh deploys crash with "Unable to connect to the database".
const config = require('./index');
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
let sqliteStorage;
if (envDbStorage === ':memory:') {
  sqliteStorage = ':memory:';
} else if (envDbStorage) {
  sqliteStorage = path.resolve(__dirname, '..', '..', envDbStorage);
} else if (process.env.NODE_ENV === 'test') {
  sqliteStorage = ':memory:';
} else {
  sqliteStorage = path.resolve(__dirname, '..', '..', './database.sqlite');
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
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB, Sequelize };
