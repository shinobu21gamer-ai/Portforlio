export function safeParse(json, fallback = null) {
  try { return JSON.parse(json); } catch { return fallback; }
}

export function peso(n) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Formats a SQL TIME ("09:00", "18:00:00") as "9:00 AM".
export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = String(timeStr).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

// Masks a sensitive identifier for on-screen display, keeping the last `visible`
// characters. Returns an em dash when there is nothing to show.
export function maskId(value, visible = 4) {
  const s = String(value || '').trim();
  if (!s) return '—';
  if (s.length <= visible) return '*'.repeat(s.length);
  return `${'*'.repeat(s.length - visible)}${s.slice(-visible)}`;
}

export function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
    label: `${monday.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`,
  };
}

export function getMonthRange(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const start = new Date(year, month, 1).toISOString().split('T')[0];
  const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
  return {
    start,
    end,
    label: d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
  };
}
