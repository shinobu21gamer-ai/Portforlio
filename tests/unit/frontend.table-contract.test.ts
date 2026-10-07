/**
 * Static guards for the two table bugs this review kept finding:
 *
 *  1. A `renderRow` whose `cellMap` keys drift from the `columns` keys renders a
 *     silently blank column (`visHeaders.map(c => cellMap[c.key])` yields
 *     undefined). POS Purchases and HRMS InvPurchases both had one.
 *  2. Columns flagged `sortable: true` on a page that never passes `onSort` draw
 *     a sort arrow that does nothing. All four HRMS inventory screens had that.
 *
 * These are source-level assertions on purpose: the pages are not mounted here,
 * but the contract being violated is visible in the file text and is exactly the
 * kind of thing a copy-paste edit reintroduces.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const PAGE_DIRS = ['frontend/src/pages', 'frontend-hrms/src/pages'];

function jsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsxFiles(p));
    else if (entry.name.endsWith('.jsx')) out.push(p);
  }
  return out;
}

const files = PAGE_DIRS.flatMap((d) => jsxFiles(path.join(ROOT, d)));
const rel = (f: string) => path.relative(ROOT, f);

describe('table column contract', () => {
  it('finds the pages to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('every column key has a matching cellMap entry', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      if (!/const cellMap = \{/.test(src)) continue;
      const columnKeys = [...src.matchAll(/\{\s*key:\s*'([^']+)'\s*,\s*label:/g)].map((m) => m[1]);
      const start = src.indexOf('const cellMap = {');
      const block = src.slice(start, src.indexOf('};', start));
      const mapKeys = new Set([...block.matchAll(/^\s*([A-Za-z0-9_]+):/gm)].map((m) => m[1]));
      const missing = columnKeys.filter((k) => !mapKeys.has(k));
      if (missing.length) offenders.push(`${rel(file)} → ${missing.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('never advertises a sortable column it cannot sort', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      const hasSortable = /\{\s*key:[^}]*sortable:\s*true/.test(src);
      if (!hasSortable) continue;
      if (!/onSort=\{/.test(src)) offenders.push(`${rel(file)} → sortable columns, no onSort`);
      if (!/sortBy=\{/.test(src) || !/sortOrder=\{/.test(src)) offenders.push(`${rel(file)} → onSort without sortBy/sortOrder`);
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the sort state wired to the query it feeds', () => {
    // A page that sorts must include the sort in the react-query key, or the
    // server response is reused for every header click.
    const offenders: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      if (!/const \[sortBy, setSortBy\]/.test(src)) continue;
      const keyLines = [...src.matchAll(/queryKey: \[[^\]]*\]/g)].map((m) => m[0]);
      const anyWithSort = keyLines.some((k) => k.includes('sortBy'));
      const viaHook = /use[A-Z]\w*\(\{[^}]*sortBy/.test(src) || /use[A-Z]\w*\(\s*\{[^}]*sortBy/.test(src);
      if (!anyWithSort && !viaHook) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });
});

describe('settings keys the UI can save', () => {
  it('writes the canonical keys the API accepts', () => {
    const src = fs.readFileSync(path.join(ROOT, 'frontend/src/pages/Settings.jsx'), 'utf8');
    // `email` is what the public settings payload and the receipt read; the
    // legacy `storeEmail` alias is only ever read as a fallback.
    expect(src).toMatch(/update\('email'/);
    expect(src).not.toMatch(/update\('storeEmail'/);
    expect(src).toMatch(/receiptHeader/);
    const validator = fs.readFileSync(path.join(ROOT, 'src/validators/index.js'), 'utf8');
    // stripUnknown silently drops anything the schema does not declare.
    expect(validator).toMatch(/email: Joi\.string\(\)\.email\(\)/);
  });
});
