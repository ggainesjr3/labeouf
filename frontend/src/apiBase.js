/** Backend root URL (no trailing slash). Empty = same origin (nginx proxy). */
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
