const API_URL = import.meta.env.VITE_API_URL || '/api/v1/hrms';

function getApiOrigin() {
  if (typeof window === 'undefined') return '';

  try {
    return new URL(API_URL, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

const API_ORIGIN = getApiOrigin();

/** Resolve API-uploaded image paths against the API host, not the HRMS host. */
export function resolveAssetUrl(source) {
  if (typeof source !== 'string') return '';

  const value = source.trim();
  if (!value) return '';
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value;
  if (value.startsWith('//')) {
    return typeof window === 'undefined'
      ? value
      : `${window.location.protocol}${value}`;
  }

  const rootRelativePath = value.startsWith('/') ? value : `/${value}`;
  return `${API_ORIGIN}${rootRelativePath}`;
}
