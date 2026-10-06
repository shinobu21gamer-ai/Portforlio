import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const { ensureDir, isDirWritable, resolveWritableDir, resolveWritableFile } = require('../../src/utils/storage');

const tempDirs: string[] = [];
const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length) {
    const dir = tempDirs.pop()!;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe('ensureDir', () => {
  it('creates nested directories and reports success', () => {
    const target = path.join(makeTempDir(), 'a', 'b', 'c');
    expect(ensureDir(target)).toBe(true);
    expect(fs.existsSync(target)).toBe(true);
  });

  it('returns false instead of throwing when the path is a file', () => {
    const file = path.join(makeTempDir(), 'blocker');
    fs.writeFileSync(file, 'x');
    expect(() => ensureDir(path.join(file, 'uploads'))).not.toThrow();
    expect(ensureDir(path.join(file, 'uploads'))).toBe(false);
  });
});

describe('isDirWritable', () => {
  it('is true for a directory it can write into', () => {
    expect(isDirWritable(path.join(makeTempDir(), 'writable'))).toBe(true);
  });

  it('is false when the path cannot be created (a file is in the way)', () => {
    const file = path.join(makeTempDir(), 'file');
    fs.writeFileSync(file, 'x');
    expect(isDirWritable(path.join(file, 'products'))).toBe(false);
  });
});

describe('resolveWritableDir', () => {
  it('uses the preferred directory when it is writable — the Render case that worked', () => {
    const preferred = path.join(makeTempDir(), 'data', 'uploads');
    expect(resolveWritableDir(preferred, { label: 'uploads directory', fallbacks: [] })).toBe(preferred);
    expect(fs.existsSync(preferred)).toBe(true);
  });

  it('falls back to a writable directory and warns instead of crashing — the EACCES case', () => {
    // '/data/uploads/products' on a host without that volume: the parent is a
    // regular file, so the mkdir fails exactly like ENOTDIR/EACCES does in the
    // reported deploy crash. The point of the helper is that this never throws.
    const file = path.join(makeTempDir(), 'data-blocker');
    fs.writeFileSync(file, 'x');
    const preferred = path.join(file, 'uploads-products');
    const fallback = path.join(makeTempDir(), 'uploads', 'products');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const resolved = resolveWritableDir(preferred, { label: 'product image directory', fallbacks: [fallback] });

    expect(resolved).toBe(fallback);
    expect(fs.existsSync(fallback)).toBe(true);
    expect(warn).toHaveBeenCalled();
    const message = warn.mock.calls.flat().join('\n');
    expect(message).toContain('[STORAGE]');
    expect(message).toContain('product image directory');
    expect(message).toContain(fallback);
  });

  it('returns the preferred path unchanged when nothing is writable (no silent relocation)', () => {
    const file = path.join(makeTempDir(), 'blocker');
    fs.writeFileSync(file, 'x');
    const preferred = path.join(file, 'uploads');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolveWritableDir(preferred, { label: 'uploads directory', fallbacks: [path.join(file, 'other')] })).toBe(preferred);
    expect(warn).toHaveBeenCalled();
  });
});

describe('resolveWritableFile', () => {
  it('uses the preferred file when its directory is writable', () => {
    const preferred = path.join(makeTempDir(), 'database.sqlite');
    expect(resolveWritableFile(preferred, { label: 'SQLite database file', fallbacks: [] })).toBe(preferred);
  });

  it('falls back to another location when the file cannot be created', () => {
    const file = path.join(makeTempDir(), 'blocker');
    fs.writeFileSync(file, 'x');
    const preferred = path.join(file, 'database.sqlite');
    const fallback = path.join(makeTempDir(), 'db', 'database.sqlite');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const resolved = resolveWritableFile(preferred, { label: 'SQLite database file', fallbacks: [fallback] });

    expect(resolved).toBe(fallback);
    expect(warn.mock.calls.flat().join('\n')).toContain('[STORAGE]');
  });

  it('never relocates an existing database that is not writable', () => {
    if (typeof process.getuid === 'function' && process.getuid() === 0) return; // root ignores mode bits
    const dir = makeTempDir();
    const preferred = path.join(dir, 'database.sqlite');
    fs.writeFileSync(preferred, 'existing-data');
    fs.chmodSync(preferred, 0o444);
    const fallback = path.join(makeTempDir(), 'other', 'database.sqlite');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const resolved = resolveWritableFile(preferred, { label: 'SQLite database file', fallbacks: [fallback] });

    expect(resolved).toBe(preferred); // reads still hit the real data
    expect(warn.mock.calls.flat().join('\n')).toContain('Refusing');
  });
});
