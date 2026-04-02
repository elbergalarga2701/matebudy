/**
 * Middleware de rate limiting simple pero efectivo
 * Implementa un algoritmo de ventana deslizante
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000, // 15 minutos por defecto
  maxRequests = 100,
  message = 'Demasiadas peticiones, intenta de nuevo más tarde',
  skipSuccessfulRequests = false,
  skipFailedRequests = false,
} = {}) {
  const requests = new Map();

  function cleanup() {
    const now = Date.now();
    for (const [key, data] of requests.entries()) {
      if (now - data.windowStart > windowMs) {
        requests.delete(key);
      }
    }
  }

  // Limpiar cada 5 minutos
  setInterval(cleanup, 5 * 60 * 1000);

  return function rateLimit(req, res, next) {
    // Skip si está configurado
    if (skipSuccessfulRequests && res.statusCode < 400) {
      return next();
    }
    if (skipFailedRequests && res.statusCode >= 400) {
      return next();
    }

    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    let userData = requests.get(key);

    if (!userData || now - userData.windowStart > windowMs) {
      userData = {
        windowStart: now,
        count: 0,
      };
      requests.set(key, userData);
    }

    userData.count++;

    // Headers de rate limiting
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - userData.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil((userData.windowStart + windowMs) / 1000));

    if (userData.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((userData.windowStart + windowMs - now) / 1000));
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil((userData.windowStart + windowMs - now) / 1000),
      });
    }

    next();
  };
}

/**
 * Rate limiters preconfigurados para casos comunes
 * NOTA: Uruguay tiene 3 millones de personas - limites muy altos
 */
export const rateLimiters = {
  // General para todas las rutas - CASI SIN LIMITES (Uruguay!)
  general: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hora
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10000', 10),
    message: 'Demasiadas peticiones desde tu IP',
  }),

  // Login - solo para evitar ataques bruteforce
  login: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '100', 10),
    message: 'Demasiados intentos de inicio de sesión',
  }),

  // Registro - solo para evitar spam
  register: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_REGISTER_MAX || '100', 10),
    message: 'Demasiados registros desde tu IP',
  }),

  // API endpoints - SIN LIMITES REALES
  api: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hora
    maxRequests: 10000,
    message: 'Demasiadas peticiones a la API',
  }),

  // Upload de archivos - limite alto
  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 200,
    message: 'Demasiados archivos subidos',
  }),
};
