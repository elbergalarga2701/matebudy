const rawBaseUrl = import.meta.env.VITE_API_URL || '';
const rawSocketUrl = import.meta.env.VITE_SOCKET_URL || '';

export const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');
export const SOCKET_URL = rawSocketUrl.replace(/\/$/, '');

const isCapacitor = typeof window !== 'undefined' && (window.location.protocol === 'capacitor:' || typeof window.Capacitor !== 'undefined');

const RENDER_BACKEND = 'https://matebudy.onrender.com';

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const serverUrl = RENDER_BACKEND;
  return `${serverUrl}${path}`;
}

export function socketUrl() {
  return RENDER_BACKEND;
}

export async function checkBackendHealth() {
  try {
    const resp = await fetch('https://matebudy.onrender.com/api/health', { method: 'GET', cache: 'no-store' });
    return resp.ok;
  } catch {
    return false;
  }
}