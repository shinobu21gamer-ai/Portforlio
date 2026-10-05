// ─── Application timezone helpers ─────────────────────────────────────────
// The business default is Asia/Manila (no DST). All stored timestamps are
// UTC; "today"/"this month" and calendar-day groupings must be computed in
// the app timezone or a UTC host (e.g. Render) mis-attributes day-boundary
// sales for a PH store (AUDIT.md B6). Override with APP_TIMEZONE.
//
// DST note: the SQL date expression below uses the offset in effect at
// query time. For a DST zone, rows near a transition may be attributed to
// the neighbouring day; the default zone has no DST, so this is exact.

const DEFAULT_TZ = process.env.APP_TIMEZONE || 'Asia/Manila';

const cache = new Map();

const getDtf = (tz) => {
  if (!cache.has(tz)) {
    cache.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
  }
  return cache.get(tz);
};

/** UTC offset (minutes) of `tz` at the instant `date`. */
const tzOffsetMinutes = (tz, date) => {
  const parts = {};
  for (const { type, value } of getDtf(tz).formatToParts(date)) parts[type] = value;
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  );
  return Math.round((asUTC - date.getTime()) / 60000);
};

/**
 * UTC-instant bounds of the local calendar day containing `date`.
 * Returns { start, end } (end exclusive), both JS Dates in UTC.
 */
const localDayBounds = (tz, date = new Date()) => {
  // Local wall-clock = UTC instant + zone offset (encoded as "fake UTC").
  const off = tzOffsetMinutes(tz, date);
  const wall = new Date(date.getTime() + off * 60000);
  const dayStartWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
  // ...and local midnight back to a real UTC instant = wall midnight - offset.
  const start = new Date(dayStartWall - off * 60000);
  return { start, end: new Date(start.getTime() + 86400000) };
};

/** Local calendar date string (YYYY-MM-DD) for `date` in `tz`. */
const localDateStr = (tz, date = new Date()) => {
  const { start } = localDayBounds(tz, date);
  const off = tzOffsetMinutes(tz, date);
  return new Date(start.getTime() + off * 60000).toISOString().split('T')[0];
};

/**
 * UTC-instant bounds of the local calendar month containing `date`.
 * Returns { start, end } (end exclusive).
 */
const localMonthBounds = (tz, date = new Date()) => {
  // Local wall-clock = UTC instant + zone offset (encoded as "fake UTC").
  const off = tzOffsetMinutes(tz, date);
  const wall = new Date(date.getTime() + off * 60000);
  const monthStartWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1);
  const monthEndWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth() + 1, 1);
  return { start: new Date(monthStartWall - off * 60000), end: new Date(monthEndWall - off * 60000) };
};

const formatOffset = (offsetMinutes) => {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
};

/**
 * SQL expression converting a UTC-stored timestamp column to the local
 * calendar date (YYYY-MM-DD) in `tz`. Works with the app's two dialects.
 * `column` is the raw SQL column expression (e.g. `s.created_at`).
 */
const sqlLocalDateExpr = (column, tz, dialect, now = new Date()) => {
  const off = formatOffset(tzOffsetMinutes(tz, now));
  if (dialect === 'sqlite') {
    return `date(${column}, '${off}')`;
  }
  // mysql: created_at is stored as UTC; CONVERT_TZ with explicit offsets.
  return `DATE(CONVERT_TZ(${column}, '+00:00', '${off}'))`;
};

/**
 * Local day bounds for a report date input.
 * Accepts either a local YYYY-MM-DD calendar date (the normal case — the
 * report UI sends dates, not instants) or a full ISO datetime, in which case
 * the local day CONTAINING that instant is used.
 */
const localDateBoundsForDate = (tz, dateStr) => {
  const s = String(dateStr || '');
  if (s.includes('T') || s.includes(' ') || s.includes('/')) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${dateStr}`);
    return localDayBounds(tz, d);
  }
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date: ${dateStr}`);
  // Anchor at local noon to dodge DST edges when resolving the offset.
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return localDayBounds(tz, anchor);
};

module.exports = {
  DEFAULT_TZ,
  tzOffsetMinutes,
  localDayBounds,
  localDateStr,
  localMonthBounds,
  sqlLocalDateExpr,
  localDateBoundsForDate,
};
