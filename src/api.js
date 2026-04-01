const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const RENDER_BACKEND = isProduction ? 'https://matebudy.onrender.com' : 'http://localhost:3000';

let computedApiUrl = RENDER_BACKEND;

export function apiUrl(path) {
  return `${computedApiUrl}${path}`;
}

export function socketUrl() {
  return RENDER_BACKEND;
}

export async function checkBackendHealth() {
  try {
    const resp = await fetch(`${RENDER_BACKEND}/api/health`, { method: 'GET', cache: 'no-store' });
    return resp.ok;
  } catch {
    return false;
  }
}