const RENDER_BACKEND = 'https://matebudy.onrender.com';

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