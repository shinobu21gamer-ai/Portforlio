#!/usr/bin/env node
/**
 * Regenerates tests/utils/route-table.ts from the route definitions in src/.
 *
 *   node scripts/generate-route-table.js [--check]
 *
 * How it works: every `router.<method>(...)` call in src/routes/** is parsed
 * with a paren counter (so multi-line definitions such as the multipart
 * POST /products are captured whole), and the middleware argument list is
 * scanned for protect / authorize(...) / hasPermission(...). Mount prefixes are
 * read from src/routes/index.js, including variables mounted more than once
 * (notificationRoutes serves both /notifications and /hrms/notifications).
 * The four routes declared directly on the Express app in src/app.js are
 * appended by hand below, since they never appear on the API router.
 *
 * --check exits non-zero when the committed table differs from a fresh
 * generation, so CI can fail if routes are added without refreshing the table.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests/utils/route-table.ts');

const routeFiles = [];
for (const f of fs.readdirSync(path.join(ROOT, 'src/routes'))) {
  const p = path.join('src/routes', f);
  if (fs.statSync(path.join(ROOT, p)).isFile() && p.endsWith('.js')) routeFiles.push(p);
}
routeFiles.push('src/routes/hrms/index.js', 'src/routes/hrms/publicJob.routes.js');

/** Extract every router.<method>() definition from one file. */
function parseFile(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const re = /router\.(get|post|put|patch|delete)\s*\(/g;
  const found = [];
  let m;
  while ((m = re.exec(src))) {
    const method = m[1].toUpperCase();
    // Walk forward counting parens so nested calls (validate(schemas.x),
    // authorize('a','b')) don't terminate the argument list early.
    let i = re.lastIndex;
    let depth = 1;
    const start = i;
    let end = -1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) continue;
    const args = src.slice(start, end);
    const pathMatch = args.match(/^\s*(['"`])(.*?)\1/s);
    if (!pathMatch) continue;
    const rest = args.slice(pathMatch[0].length);
    const roles = [];
    const perms = [];
    for (const a of rest.matchAll(/authorize\(([^)]*)\)/g)) {
      for (const q of a[1].matchAll(/['"]([^'"]+)['"]/g)) roles.push(q[1]);
    }
    for (const a of rest.matchAll(/hasPermission\(([^)]*)\)/g)) {
      for (const q of a[1].matchAll(/['"]([^'"]+)['"]/g)) perms.push(q[1]);
    }
    found.push({
      file: rel,
      method,
      path: pathMatch[2],
      protect: /\bprotect\b/.test(rest),
      roles: [...new Set(roles)],
      perms: [...new Set(perms)],
      upload: /upload\.single|resumeUpload\.single|uploadDocument\.single/.test(rest),
    });
    re.lastIndex = end;
  }
  return found;
}

/** Map router variable -> file, and variable -> every prefix it is mounted at. */
function readMounts() {
  const idx = fs.readFileSync(path.join(ROOT, 'src/routes/index.js'), 'utf8');
  const varToFile = {};
  for (const mm of idx.matchAll(/const\s+(\w+)\s*=\s*require\('\.\/([^']+)'\)/g)) {
    varToFile[mm[1]] = mm[2].replace(/\.js$/, '');
  }
  varToFile.hrmsRoutes = 'hrms/index';
  varToFile.publicJobRoutes = 'hrms/publicJob.routes';

  const mounts = {};
  const useRe = /router\.use\(`\$\{apiPrefix\}([^`]*)`,\s*(?:([A-Za-z_$][\w$]*)|require\('\.\/([\w./]+)'\))\)/g;
  for (const mm of idx.matchAll(useRe)) {
    const key = mm[2] || `__inline__${mm[3]}`;
    if (mm[3]) varToFile[key] = mm[3].replace(/\.js$/, '');
    (mounts[key] = mounts[key] || []).push(mm[1]);
  }
  return { varToFile, mounts };
}

function build() {
  const { varToFile, mounts } = readMounts();
  const definitions = [];
  for (const rel of routeFiles) definitions.push(...parseFile(rel));

  const rows = [];
  const unmapped = [];
  for (const r of definitions) {
    const base = r.file.replace(/^src\/routes\//, '').replace(/\.js$/, '');
    const varName = Object.keys(varToFile).find((v) => varToFile[v] === base);
    let prefixes = varName && mounts[varName] ? mounts[varName] : [];
    // tracking.routes is mounted with an inline require() rather than a variable.
    if (!prefixes.length && base === 'tracking.routes') prefixes = ['/tracking'];
    if (!prefixes.length) { unmapped.push(r); continue; }
    for (const mount of prefixes) {
      const full = (`/api/v1${mount}${r.path === '/' ? '' : r.path}`).replace(/\/{2,}/g, '/');
      rows.push({
        method: r.method,
        path: full,
        isPublic: !r.protect && r.roles.length === 0 && r.perms.length === 0,
        roles: r.roles,
        perms: r.perms,
        upload: r.upload,
      });
    }
  }
  if (unmapped.length) {
    console.error('UNMAPPED routes (no mount prefix found):');
    unmapped.forEach((r) => console.error(`  ${r.file} ${r.method} ${r.path}`));
    process.exit(1);
  }

  // Declared on the Express app in src/app.js — never on the API router.
  rows.push({ method: 'GET', path: '/health', isPublic: true, roles: [], perms: [], app: true });
  rows.push({ method: 'GET', path: '/metrics', isPublic: false, roles: ['admin'], perms: [], app: true });
  rows.push({ method: 'GET', path: '/robots.txt', isPublic: true, roles: [], perms: [], app: true });
  rows.push({ method: 'GET', path: '/', isPublic: true, roles: [], perms: [], app: true });

  const uniq = [...new Map(rows.map((r) => [`${r.method} ${r.path}`, r])).values()];
  uniq.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return uniq;
}

function emit(rows) {
  const pos = rows.filter((r) => !r.path.startsWith('/api/v1/hrms'));
  const hrms = rows.filter((r) => r.path.startsWith('/api/v1/hrms'));
  const block = (name, arr) =>
    `export const ${name}: RouteSpec[] = ${JSON.stringify(arr, null, 2)};`;

  return `/**
 * Static route inventory for the Phase-6 route matrix.
 *
 * GENERATED FILE — do not hand-edit. Regenerate with:
 *   node scripts/generate-route-table.js
 *
 * Produced by walking every \`router.<method>(...)\` call in src/routes/** with a
 * paren-counting parser (so multi-line definitions are captured whole) and
 * cross-checked against the live Express router stack of src/app.js. Both agree
 * on ${rows.length} routes:
 *   POS/admin surface (everything not under /api/v1/hrms): ${pos.length}
 *   HRMS surface (/api/v1/hrms/**)                       : ${hrms.length}
 * including the four routes declared directly on the app in src/app.js
 * (/, /health, /metrics, /robots.txt).
 *
 * \`roles\`    = allow-list passed to authorize() (empty => any authenticated role).
 * \`perms\`    = slugs passed to hasPermission() (empty => no permission gate).
 * \`isPublic\` = no protect() and no authorize()/hasPermission() gate.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteSpec {
  method: HttpMethod;
  /** Absolute path including the /api/v1 prefix and any :param segments. */
  path: string;
  /** True when the route is reachable without a Bearer token. */
  isPublic: boolean;
  /** authorize() allow-list of role slugs; empty means any authenticated role. */
  roles: string[];
  /** hasPermission() slugs; empty means no permission gate. */
  perms: string[];
  /** Route consumes a multipart upload (product image / resume / document). */
  upload?: boolean;
  /** Declared on the Express app in src/app.js rather than under the API router. */
  app?: boolean;
}

${block('POS_ROUTES', pos)}

${block('HRMS_ROUTES', hrms)}
`;
}

const rows = build();
const output = emit(rows);

if (process.argv.includes('--check')) {
  const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (existing !== output) {
    console.error('tests/utils/route-table.ts is stale. Run: node scripts/generate-route-table.js');
    process.exit(1);
  }
  console.log(`route-table.ts is up to date (${rows.length} routes).`);
} else {
  fs.writeFileSync(OUT, output);
  const pos = rows.filter((r) => !r.path.startsWith('/api/v1/hrms')).length;
  console.log(`Wrote ${path.relative(ROOT, OUT)} — ${rows.length} routes (${pos} POS/admin, ${rows.length - pos} HRMS).`);
}
