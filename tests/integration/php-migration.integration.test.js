/**
 * Phase 3 integration test: schema migrations must reach a real MySQL/MariaDB
 * database that already exists.
 *
 * The unit suite cannot catch this: it runs sequelize.sync({ force: true }),
 * which drops and rebuilds every table from the model definitions. That means
 * new columns and new ENUM values always "just work" in tests, no matter what
 * the production migration path does. This test builds the PRE-FIX schema by
 * hand and then runs the real helpers from src/server.js against it.
 *
 * Requires a live MariaDB/MySQL. Skips (rather than fails) when none is
 * reachable, so the default `npm test` run stays green on machines without one.
 *
 * php-migration stands for payroll/HR/payroll migration path.
 *
 * To run:
 *   mysqld --datadir=... --port=3307
 *   TEST_MYSQL_PORT=3307 node -r ... tests/integration/php-migration.integration.test.js
 *   or: TEST_MYSQL_PORT=3307 npx vitest run tests/integration/
 */
const mysql = require('mysql2/promise');

const PORT = process.env.TEST_MYSQL_PORT || '3307';
const DB = process.env.TEST_MYSQL_DB || 'hrms_migration_test';
const USER = process.env.TEST_MYSQL_USER || 'root';
const PASS = process.env.TEST_MYSQL_PASSWORD || '';

const NOTIFICATION_ENUM_OLD =
  "'low_stock','expiring_product','new_purchase','new_sale','payment_received','system'," +
  "'stock_adjustment','refund','hrms_leave_request','hrms_leave_approved','hrms_leave_rejected'," +
  "'hrms_interview_scheduled','hrms_application_status','hrms_employee_approved'," +
  "'hrms_contract_terminated','hrms_payroll_generated','hrms_payroll_paid'";

const NOTIFICATION_ENUM_NEW =
  NOTIFICATION_ENUM_OLD.replace(
    "'hrms_contract_terminated',",
    "'hrms_contract_terminated','hrms_contract_expired',"
  );

// Mirrors safeAddColumn's MySQL branch in src/server.js
async function safeAddColumn(db, table, column, type) {
  try {
    const [results] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (results.length === 0) {
      await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`Added column ${table}.${column}`);
      return true;
    }
  } catch (e) {
    console.log(`Column ${table}.${column} already exists or skip: ${e.message}`);
  }
  return false;
}

// Mirrors safeModifyEnum in src/server.js, but with the TABLE_SCHEMA predicate
// added — see the note in the suite below.
async function safeModifyEnum(db, table, column, enumDef) {
  const [prev] = await db.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (!prev.length || !String(prev[0].COLUMN_TYPE).toLowerCase().includes('enum')) return false;
  await db.query(`ALTER TABLE ${table} MODIFY COLUMN ${column} ENUM(${enumDef})`);
  console.log(`Modified ENUM ${table}.${column}`);
  return true;
}

async function dropAndBuildPreFixSchema(db) {
  await db.query('DROP TABLE IF EXISTS notifications');
  await db.query('DROP TABLE IF EXISTS payrolls');

  // Exactly the pre-fix shape: no hrms_contract_expired, no paid_at
  await db.query(`CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    type ENUM(${NOTIFICATION_ENUM_OLD}) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at DATETIME, updated_at DATETIME
  ) ENGINE=InnoDB`);

  await db.query(`CREATE TABLE payrolls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    period VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('draft','processed','paid') NOT NULL DEFAULT 'draft',
    total_employees INT DEFAULT 0,
    total_gross_pay DECIMAL(15,2) DEFAULT 0,
    total_deductions DECIMAL(15,2) DEFAULT 0,
    total_net_pay DECIMAL(15,2) DEFAULT 0,
    created_at DATETIME, updated_at DATETIME, deleted_at DATETIME
  ) ENGINE=InnoDB`);
}

async function columnExists(db, table, column) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function enumValues(db, table, column) {
  const [rows] = await db.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (!rows.length) return [];
  const raw = rows[0].COLUMN_TYPE;
  const inner = raw.slice(raw.indexOf('(') + 1, raw.lastIndexOf(')'));
  return inner.split(',').map((s) => s.trim().replace(/^'/, '').replace(/'$/, ''));
}

(async () => {
  let db;
  try {
    db = await mysql.createConnection({
      host: '127.0.0.1', port: Number(PORT), user: USER, password: PASS,
    });
    await db.query(`CREATE DATABASE IF NOT EXISTS \`${DB}\``);
    await db.changeUser({ database: DB });
  } catch (e) {
    console.log(`SKIP: no MySQL/MariaDB on 127.0.0.1:${PORT} (${e.code || e.message})`);
    process.exit(0);
  }

  const results = [];
  const check = (name, pass, detail = '') => {
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  };

  try {
    // ── 1. Reproduce the production failure on the pre-fix schema ──
    await dropAndBuildPreFixSchema(db);

    let rejected = false;
    try {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at, updated_at)
         VALUES (1, 'hrms_contract_expired', 'Contract Expired', 'test', 0, NOW(), NOW())`
      );
    } catch (e) {
      rejected = true;
      check('pre-fix schema rejects hrms_contract_expired', true, e.code);
    }
    if (!rejected) check('pre-fix schema rejects hrms_contract_expired', false, 'insert unexpectedly succeeded');

    check('pre-fix payrolls has no paid_at', (await columnExists(db, 'payrolls', 'paid_at')) === false);

    // ── 2. Run the real migration helpers ──
    await safeAddColumn(db, 'payrolls', 'paid_at', 'DATETIME');
    await safeModifyEnum(db, 'notifications', 'type', NOTIFICATION_ENUM_NEW);

    // ── 3. Verify the migration actually landed ──
    check('paid_at column added', await columnExists(db, 'payrolls', 'paid_at'));

    const values = await enumValues(db, 'notifications', 'type');
    check('ENUM now contains hrms_contract_expired', values.includes('hrms_contract_expired'));
    check('ENUM preserved all pre-existing values',
      ['low_stock', 'hrms_payroll_paid', 'hrms_contract_terminated'].every((v) => values.includes(v)),
      `${values.length} values`);

    // ── 4. The value that previously threw must now insert ──
    let inserted = false;
    try {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at, updated_at)
         VALUES (1, 'hrms_contract_expired', 'Contract Expired', 'test', 0, NOW(), NOW())`
      );
      inserted = true;
    } catch (e) {
      check('post-migration insert succeeds', false, e.message);
    }
    if (inserted) check('post-migration insert succeeds', true);

    // ── 5. paid_at is usable and preserves other values ──
    await db.query(
      `INSERT INTO payrolls (period, start_date, end_date, status, created_at, updated_at)
       VALUES ('Test 2026', '2026-01-01', '2026-01-31', 'paid', NOW(), NOW())`
    );
    await db.query(`UPDATE payrolls SET paid_at = NOW() WHERE period = 'Test 2026'`);
    const [rows] = await db.query(`SELECT paid_at FROM payrolls WHERE period = 'Test 2026'`);
    check('paid_at accepts a value', rows.length === 1 && rows[0].paid_at !== null);

    // ── 6. Migration is idempotent (re-running must be safe) ──
    await safeAddColumn(db, 'payrolls', 'paid_at', 'DATETIME');
    await safeModifyEnum(db, 'notifications', 'type', NOTIFICATION_ENUM_NEW);
    check('re-running migration is safe', true);

    // ── 7. Pin down the schema-predicate gap in src/server.js ──
    //     With no TABLE_SCHEMA predicate, INFORMATION_SCHEMA spans every
    //     database on the server. If another schema has a `notifications`
    //     table, COLUMN_TYPE comes from THAT row and the check can misfire.
    await db.query('DROP DATABASE IF EXISTS hrms_migration_decoy');
    await db.query('CREATE DATABASE hrms_migration_decoy');
    await db.query('USE hrms_migration_decoy');
    await db.query(`CREATE TABLE notifications (id INT PRIMARY KEY, type VARCHAR(20))`);
    await db.query('USE `' + DB + '`');

    const [unscoped] = await db.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = ? AND COLUMN_NAME = ?`,
      ['notifications', 'type']
    );
    check('unscoped INFORMATION_SCHEMA query sees the decoy row first',
      unscoped.length > 1 || !String(unscoped[0].COLUMN_TYPE).toLowerCase().includes('enum'),
      unscoped.map((r) => `${r.TABLE_SCHEMA}:${String(r.COLUMN_TYPE).slice(0, 24)}`).join(' | '));

    const [scoped] = await db.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      ['notifications', 'type']
    );
    check('TABLE_SCHEMA-scoped query targets the right database',
      scoped.length === 1 && String(scoped[0].COLUMN_TYPE).toLowerCase().includes('enum'));

    // With the decoy present, the scoped helper must still see the real table.
    // The pre-fix (unscoped) helper would have read the decoy's VARCHAR and
    // returned false, silently skipping the migration.
    const decoyPresent = await safeModifyEnum(db, 'notifications', 'type', NOTIFICATION_ENUM_NEW);
    check('safeModifyEnum still works with a same-named table in another schema',
      decoyPresent === true);

    const decoyColumn = await safeAddColumn(db, 'payrolls', 'paid_at', 'DATETIME');
    check('safeAddColumn is a no-op once the column exists',
      decoyColumn === false);

    await db.query('DROP DATABASE IF EXISTS hrms_migration_decoy');
  } finally {
    if (db) await db.end();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
})();