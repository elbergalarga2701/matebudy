const rawBaseUrl = import.meta.env.VITE_API_URL || '';
const rawSocketUrl = import.meta.env.VITE_SOCKET_URL || '';

export const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');
export const SOCKET_URL = rawSocketUrl.replace(/\/$/, '');

const isCapacitor = typeof window !== 'undefined' && window.location.protocol === 'capacitor:';

const SERVER_URL = 'https://matebudy.onrender.com';

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  if (isCapacitor) {
    const cleanPath = path.replace(/^\/api/, '');
    return `${SERVER_URL}${cleanPath}`;
  }
  if (!API_BASE_URL) return path;
  const cleanPath = path.replace(/^\/api/, '');
  return `${API_BASE_URL}${cleanPath}`;
}

export function socketUrl() {
  if (isCapacitor) return SERVER_URL;
  return SOCKET_URL || 'http://localhost:3000';
}
