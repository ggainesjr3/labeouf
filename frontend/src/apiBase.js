/** Backend root URL (no trailing slash). Empty = same origin (nginx proxy). */
function resolveApiBase() {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('superb-patience-production')) {
      return 'https://labeouf-production.up.railway.app';
    }
  }

  return '';
}

export const API_BASE = resolveApiBase();

/** Turn /uploads/... paths into absolute URLs when API is on another host. */
export function mediaUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
}
