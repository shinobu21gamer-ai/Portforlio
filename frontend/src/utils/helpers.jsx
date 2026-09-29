import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function peso(n) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function statusBadge(status) {
  const map = {
    completed: 'success', paid: 'success', active: 'success', received: 'success',
    pending: 'warning', ordered: 'warning', partial: 'warning', partially_refunded: 'warning',
    cancelled: 'error', refunded: 'error', inactive: 'error',
  };
  return <span className={`badge ${map[status] || 'info'}`}>{status}</span>;
}

export function productEmoji(category) {
  const slug = typeof category === 'string' ? category : category?.slug || category?.name?.toLowerCase() || '';
  const map = {
    foods: '🍪', home: '🧴', gifts: '🎁', liquor: '🍷',
  };
  return map[slug] || '📦';
}
