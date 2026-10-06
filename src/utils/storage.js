// Storage-path resolution that can never take the server down at boot.
//
// Why this exists: the uploads directory (and the SQLite file) live on a
// volume that may be missing or unwritable when the process starts — e.g. a
// Render free instance, which CANNOT attach a persistent disk, so /data does
// not exist even though UPLOAD_DIR=/data/uploads is set. src/middleware/upload.js
// used to call fs.mkdirSync() at require time, so the EACCES below crashed the
// whole process before it could bind a port: no healthcheck, no logs beyond a
// stack trace, deploy marked "not publishing".
//
//   Error: EACCES: permission denied, mkdir '/data/uploads/products'
//     at Object.<anonymous> (/app/src/middleware/upload.js:10:6)
//
// Policy:
//   • Preferred path writable          → use it.
//   • Not writable, no data there yet  → fall back to an app-local path, then
//                                        the OS temp dir, with a loud warning
//                                        that written data is ephemeral.
//   • Data already exists at the path  → never silently switch to a different
//                                        file. An empty database "recovered"
//                                        next to the real one is worse than a
//                                        clear failure.
const fs = require('fs');
const os = require('os');
const path = require('path');

// Repository / installation root (the directory that holds package.json).
const APP_ROOT = path.resolve(__dirname, '..', '..');
// Always-writable last resort. Files here survive a restart but not the
// container/host being recycled, and are never backed up.
const TMP_ROOT = path.join(os.tmpdir(), 'minimart-pos');

const ensureDir = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
    return true;
  } catch {
    return false;
  }
};

// A directory is only trusted after a real write+delete probe: on some systems
// mkdir succeeds but writing next to it does not (read-only mount, quota,
// SELinux, root-squash NFS).
const isDirWritable = (dir) => {
  if (!ensureDir(dir)) return false;
  const probe = path.join(dir, `.write-probe-${process.pid}-${Date.now()}`);
  try {
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
};

const isFileWritable = (file) => {
  try {
    fs.accessSync(file, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

const emit = (level, lines) => {
  const text = lines.map((line) => `[STORAGE] ${line}`).join('\n');
  if (level === 'log') console.log(text);
  else console.warn(text);
};

const warn = (lines) => emit('warn', lines);

const uniquePaths = (paths) => [...new Set(paths.filter(Boolean).map((p) => path.resolve(p)))];

// Resolve a directory that the app must be able to write to (uploads/…).
// Returns the effective absolute path; creates it as a side effect.
const resolveWritableDir = (preferred, options = {}) => {
  // `level` is 'warn' for an explicitly configured path (the operator asked for
  // it, so being unable to honour it is a real problem) and 'log' for a default
  // that was simply normalised to another writable place.
  const { label = 'uploads directory', fallbacks = [], level = 'warn' } = options;
  const target = path.resolve(preferred);

  if (isDirWritable(target)) return target;

  const alternatives = uniquePaths(fallbacks).filter((p) => p !== target);
  for (const alt of alternatives) {
    if (!isDirWritable(alt)) continue;
    emit(level, [
      `Cannot write to the ${label} at ${target} (permission denied or read-only filesystem).`,
      `Falling back to ${alt}. Uploads will work, but anything stored there is LOST on the next deploy/restart.`,
      'Fix: point the volume at a writable location the app user owns — Render requires a paid instance for persistent disks; in Docker, chown the volume (e.g. chown -R 1001:1001 <volume>).',
    ]);
    return alt;
  }

  warn([
    `The ${label} at ${target} is not writable and no fallback location could be created.`,
    'Writes to it will fail with a permission error until the volume permissions are fixed.',
  ]);
  return target;
};

// Resolve a file the app must be able to write (SQLite database, settings).
// Only the parent directory and the existing file are probed.
const resolveWritableFile = (preferred, options = {}) => {
  const { label = 'data file', fallbacks = [] } = options;
  const target = path.resolve(preferred);
  const dir = path.dirname(target);
  const exists = fs.existsSync(target);

  if (isDirWritable(dir) && (!exists || isFileWritable(target))) return target;

  if (exists) {
    warn([
      `The ${label} at ${target} exists but cannot be written (check ownership/permissions).`,
      'Refusing to start from a different file: that would silently open an empty store while the real data stays behind.',
      'Fix the file/directory permissions or point the volume at a writable location, then restart.',
    ]);
    return target;
  }

  const alternatives = uniquePaths(fallbacks).filter((p) => p !== target);
  for (const alt of alternatives) {
    const altExists = fs.existsSync(alt);
    if (!isDirWritable(path.dirname(alt)) || (altExists && !isFileWritable(alt))) continue;
    warn([
      `Cannot create the ${label} at ${target} (permission denied or read-only filesystem).`,
      `Falling back to ${alt}. The app will run, but that file is LOST on the next deploy/restart.`,
      'Fix: point the volume at a writable location the app user owns — Render requires a paid instance for persistent disks; in Docker, chown the volume (e.g. chown -R 1001:1001 <volume>).',
    ]);
    return alt;
  }

  warn([
    `The ${label} at ${target} cannot be created and no fallback location is available.`,
    'Startup will most likely fail until the volume permissions are fixed.',
  ]);
  return target;
};

module.exports = {
  APP_ROOT,
  TMP_ROOT,
  ensureDir,
  isDirWritable,
  resolveWritableDir,
  resolveWritableFile,
};
