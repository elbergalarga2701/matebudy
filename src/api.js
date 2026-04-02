const RAILWAY_APP_ORIGIN = 'https://matebudy.up.railway.app';
const LOCAL_BACKEND = 'http://127.0.0.1:3000';

function stripTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function safeParseUrl(value) {
  try {
    return new URL(String(value || ''));
  } catch {
    return null;
  }
}

function hasExplicitOrigin(value) {
  return /^(https?:|data:|blob:)/i.test(String(value || ''));
}

function stripApiSuffix(value) {
  return stripTrailingSlash(value).replace(/\/api$/i, '');
}

function joinBaseAndPath(base, path) {
  const normalizedBase = stripTrailingSlash(base);
  const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${path}`;

  if (!normalizedBase) {
    return normalizedPath;
  }

  if (normalizedBase.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${normalizedBase}${normalizedPath.slice(4)}`;
  }

  return `${normalizedBase}${normalizedPath}`;
}

function isNativePlatform() {
  if (typeof window === 'undefined') return false;

  // Protocolo nativo
  if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:') {
    return true;
  }

  // Android WebView
  if (/Android/i.test(window.navigator.userAgent || '')) {
    return true;
  }

  // Capacitor API
  if (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform()) {
    return true;
  }

  // Android bridge
  if (typeof window.android !== 'undefined' || typeof window.webkit !== 'undefined') {
    return true;
  }

  return false;
}

function isPrivateOrLocalHostname(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase();

  if (!normalized) return true;
  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]') {
    return true;
  }

  return (
    /^10\./.test(normalized)
    || /^192\.168\./.test(normalized)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

function sanitizeConfiguredUrl(value) {
  const normalized = stripTrailingSlash(value);
  if (!normalized) return '';

  const parsed = safeParseUrl(normalized);
  if (!parsed || !/^https?:$/i.test(parsed.protocol)) {
    return '';
  }

  if (import.meta.env.PROD) {
    if (isPrivateOrLocalHostname(parsed.hostname)) {
      return '';
    }

    if (parsed.hostname.endsWith('.onrender.com')) {
      return '';
    }
  }

  return normalized;
}

function getBrowserOrigin() {
  if (typeof window === 'undefined') return '';
  if (!/^https?:$/i.test(window.location.protocol)) return '';
  return stripTrailingSlash(window.location.origin);
}

function resolveApiBase() {
  const envApiBase = sanitizeConfiguredUrl(import.meta.env.VITE_API_URL);
  if (envApiBase) {
    return envApiBase;
  }

  if (isNativePlatform()) {
    console.log('[api.js] NATIVE PLATFORM - Using Railway backend');
    return RAILWAY_APP_ORIGIN;
  }

  if (typeof window === 'undefined') {
    return import.meta.env.PROD ? RAILWAY_APP_ORIGIN : LOCAL_BACKEND;
  }

  const { hostname, port } = window.location;
  const isLocalDevServer = (hostname === 'localhost' || hostname === '127.0.0.1') && port === '5173';

  if (isLocalDevServer) {
    return LOCAL_BACKEND;
  }

  const browserOrigin = getBrowserOrigin();
  if (browserOrigin) {
    return browserOrigin;
  }

  return import.meta.env.PROD ? RAILWAY_APP_ORIGIN : LOCAL_BACKEND;
}

function resolveSocketBase(apiBase) {
  const envSocketBase = sanitizeConfiguredUrl(import.meta.env.VITE_SOCKET_URL);
  if (envSocketBase) {
    return envSocketBase;
  }

  return stripApiSuffix(apiBase);
}

function resolveAppOrigin(apiBase, socketBase) {
  const browserOrigin = getBrowserOrigin();
  if (!isNativePlatform() && browserOrigin) {
    return browserOrigin;
  }

  return stripApiSuffix(socketBase || apiBase) || RAILWAY_APP_ORIGIN;
}

function resolveUpdateManifestUrl(appOrigin) {
  const envUpdateUrl = sanitizeConfiguredUrl(import.meta.env.VITE_UPDATE_URL);
  if (envUpdateUrl) {
    return envUpdateUrl;
  }

  return joinBaseAndPath(appOrigin, '/update.json');
}

const computedApiBase = resolveApiBase();
const computedSocketBase = resolveSocketBase(computedApiBase);
const computedAppOrigin = resolveAppOrigin(computedApiBase, computedSocketBase);
const computedUpdateManifestUrl = resolveUpdateManifestUrl(computedAppOrigin);

console.log('[api.js] Configuration:', {
  apiBase: computedApiBase,
  socketBase: computedSocketBase,
  appOrigin: computedAppOrigin,
  updateManifestUrl: computedUpdateManifestUrl,
  isNative: isNativePlatform(),
});

export function apiUrl(path) {
  return joinBaseAndPath(computedApiBase, path);
}

export function socketUrl() {
  return computedSocketBase;
}

export function appOrigin() {
  return computedAppOrigin;
}

export function updateManifestUrl() {
  return computedUpdateManifestUrl;
}

export function runtimeIsNativePlatform() {
  return isNativePlatform();
}

export function publicFileUrl(value) {
  if (!value) return '';
  if (hasExplicitOrigin(value)) return value;
  return joinBaseAndPath(computedSocketBase || computedApiBase, value);
}

export async function checkBackendHealth() {
  try {
    const resp = await fetch(apiUrl('/api/health'), { method: 'GET', cache: 'no-store' });
    return resp.ok;
  } catch {
    return false;
  }
}
