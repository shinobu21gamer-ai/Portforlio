// First-run admin bootstrap (production).
//
// Production deploys must never start with known demo credentials
// (admin@minimart.com / admin123, etc.). Instead, when the users table is
// empty on first boot, this creates exactly one admin account:
//   - with INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD when provided
//     (set them as encrypted secrets in Render before first deploy), or
//   - with a generated 32-char password that is printed to the deploy logs
//     exactly once.
// The account is flagged mustChangePassword, so every other route returns
// 403 { code: 'MUST_CHANGE_PASSWORD' } until the first login changes it
// (enforced in src/middleware/auth.js).

const crypto = require('crypto');

const MIN_PASSWORD_LENGTH = 12;

/**
 * Resolve the first-admin credentials from an env object.
 * Exported separately from the DB work so it is trivially unit-testable.
 */
const resolveFirstAdmin = (env = process.env) => {
  const email = (env.INITIAL_ADMIN_EMAIL || 'admin@minimart.com').toLowerCase();
  const provided = env.INITIAL_ADMIN_PASSWORD || '';
  const generated = provided.length < MIN_PASSWORD_LENGTH;
  return {
    email,
    password: generated ? crypto.randomBytes(16).toString('hex') : provided,
    generated,
  };
};

const logGeneratedBanner = ({ email, password }) => {
  console.log('');
  console.log('='.repeat(62));
  console.log('  FIRST-RUN ADMIN ACCOUNT CREATED (database was empty)');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log('  This password is shown ONCE — store it securely now.');
  console.log('  First login is forced to change it (mustChangePassword).');
  console.log('  To use your own instead, set INITIAL_ADMIN_EMAIL and');
  console.log('  INITIAL_ADMIN_PASSWORD (12+ chars) before next deploy.');
  console.log('='.repeat(62));
  console.log('');
};

/**
 * If no users exist yet, create the first admin account and force a
 * password change at first login. No-op when users already exist
 * (idempotent across restarts / deploys).
 *
 * @returns {Promise<{email: string, generated: boolean}|null>}
 */
const ensureFirstAdmin = async () => {
  const { User, Role } = require('../models');

  const existing = await User.count();
  if (existing > 0) return null;

  const [adminRole] = await Role.findOrCreate({
    where: { slug: 'admin' },
    defaults: { name: 'Admin', slug: 'admin', description: 'Full system access' },
  });

  const { email, password, generated } = resolveFirstAdmin();
  await User.create({
    firstName: 'Admin',
    lastName: 'Account',
    email,
    password, // hashed by the User beforeCreate hook
    roleId: adminRole.id,
    isActive: true,
    mustChangePassword: true,
  });

  if (generated) {
    logGeneratedBanner({ email, password });
  } else {
    console.log(`[SETUP] Created first-run admin account ${email} from INITIAL_ADMIN_PASSWORD. First login must change the password.`);
  }
  return { email, generated };
};

module.exports = { ensureFirstAdmin, resolveFirstAdmin, MIN_PASSWORD_LENGTH };
