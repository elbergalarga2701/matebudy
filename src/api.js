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

function resolveApiBase() {
  const envApiBase = stripTrailingSlash(import.meta.env.VITE_API_URL);
  if (envApiBase) {
    return envApiBase;
  }

  if (typeof window === 'undefined') {
    return RENDER_BACKEND;
  }

  const { protocol, hostname, port, origin } = window.location;
  const isNativeShell = protocol === 'capacitor:' || protocol === 'ionic:';
  const isLocalDevServer = (hostname === 'localhost' || hostname === '127.0.0.1') && port === '5173';
  const renderBackendHost = new URL(RENDER_BACKEND).hostname;
  const isSeparateRenderFrontend = hostname.endsWith('.onrender.com') && hostname !== renderBackendHost;

  if (isNativeShell) {
    return RENDER_BACKEND;
  }

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
