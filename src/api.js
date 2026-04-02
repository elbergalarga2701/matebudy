const RENDER_BACKEND = 'https://matebudy.onrender.com';
const LOCAL_BACKEND = 'http://127.0.0.1:3000';

function stripTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
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

  // Capacitor native platform check
  if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:') {
    return true;
  }

  // Android WebView detection
  if (/Android/i.test(window.navigator.userAgent || '')) {
    return true;
  }

  // Check for Capacitor/Cordova objects
  if (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform()) {
    return true;
  }

  if (typeof window.android !== 'undefined' || typeof window.webkit !== 'undefined') {
    return true;
  }

  return false;
}

function resolveApiBase() {
  // Environment variable takes precedence
  const envApiBase = stripTrailingSlash(import.meta.env.VITE_API_URL);
  if (envApiBase) {
    return envApiBase;
  }

  if (typeof window === 'undefined') {
    return RENDER_BACKEND;
  }

  // Native platforms (Capacitor/Android WebView) always use Render backend
  if (isNativePlatform()) {
    console.log('[api.js] Native platform detected, using Render backend');
    return RENDER_BACKEND;
  }

  const { protocol, hostname, port, origin } = window.location;
  const isLocalDevServer = (hostname === 'localhost' || hostname === '127.0.0.1') && port === '5173';
  const renderBackendHost = new URL(RENDER_BACKEND).hostname;
  const isSeparateRenderFrontend = hostname.endsWith('.onrender.com') && hostname !== renderBackendHost;

  if (isLocalDevServer) {
    return LOCAL_BACKEND;
  }

  if (isSeparateRenderFrontend) {
    return RENDER_BACKEND;
  }

  if (/^https?:$/i.test(protocol)) {
    return origin;
  }

  return RENDER_BACKEND;
}

function resolveSocketBase(apiBase) {
  const envSocketBase = stripTrailingSlash(import.meta.env.VITE_SOCKET_URL);
  if (envSocketBase) {
    return envSocketBase;
  }

  return stripApiSuffix(apiBase);
}

const computedApiBase = resolveApiBase();
const computedSocketBase = resolveSocketBase(computedApiBase);

console.log('[api.js] API configuration:', {
  apiBase: computedApiBase,
  socketBase: computedSocketBase,
  isNative: isNativePlatform(),
  env: import.meta.env.VITE_API_URL,
});

export function apiUrl(path) {
  return joinBaseAndPath(computedApiBase, path);
}

export function socketUrl() {
  return computedSocketBase;
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
