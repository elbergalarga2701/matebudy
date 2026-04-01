const rawBaseUrl = import.meta.env.VITE_API_URL || '';
const rawSocketUrl = import.meta.env.VITE_SOCKET_URL || '';

export const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');
export const SOCKET_URL = rawSocketUrl.replace(/\/$/, '');

const isCapacitor = typeof window !== 'undefined' && window.location.protocol === 'capacitor:';

const RENDER_BACKEND = 'https://matebudy.onrender.com';

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  
  // Use Render backend for both Capacitor and browser in production
  const useRenderBackend = isCapacitor || window.location.hostname.includes('onrender.com');
  const serverUrl = useRenderBackend ? RENDER_BACKEND : API_BASE_URL;
  const cleanPath = path.replace(/^\/api/, '');
  return `${serverUrl}${cleanPath}`;
}

export function socketUrl() {
  if (isCapacitor) return RENDER_BACKEND;
  // Use Render in production
  if (window.location.hostname.includes('onrender.com')) return RENDER_BACKEND;
  return SOCKET_URL || 'http://localhost:3000';
}

export async function checkBackendHealth() {
  try {
    const resp = await fetch('https://matebudy.onrender.com/api/health', { method: 'GET', cache: 'no-store' });
    return resp.ok;
  } catch {
    return false;
  }
}