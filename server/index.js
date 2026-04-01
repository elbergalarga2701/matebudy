import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Importar configuraciones y utilidades
import { ensureSecureConfig } from './config/security.js';
import { ensureDirectories } from './config/paths.js';
import logger, { createExpressLogger, createErrorHandler } from './utils/logger.js';
import { startAutoBackup } from './utils/backup.js';
import { rateLimiters } from './middleware/rateLimiter.js';

// Importar rutas
import { authRoutes } from './routes/auth.js';
import { chatRoutes } from './routes/chat.js';
import { userRoutes } from './routes/users.js';
import { postRoutes } from './routes/posts.js';
import { locationRoutes } from './routes/locations.js';
import { paymentRoutes } from './routes/payments.js';
import { sosRoutes } from './routes/sos.js';
import { adminRoutes } from './routes/admin.js';

// Importar base de datos
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const envPath = path.join(__dirname, '.env');

// Cargar variables de entorno desde .env si existe
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  envLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;

    const separatorIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

// =============================================================================
// CONFIGURACIÓN DE SEGURIDAD
// =============================================================================
// Verificar que los secrets estén configurados (lanza error en producción si no)
if (process.env.NODE_ENV !== 'test') {
  ensureSecureConfig();
}

// =============================================================================
// CONFIGURACIÓN DE DIRECTORIOS
// =============================================================================
ensureDirectories();

// =============================================================================
// CONFIGURACIÓN DEL SERVIDOR
// =============================================================================
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const JSON_LIMIT = process.env.JSON_LIMIT || '10mb';
const packageJsonPath = path.join(projectRoot, 'package.json');

const appVersion = (() => {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version || '1.0.0';
  } catch (error) {
    logger.error('Error leyendo package.json', { error: error.message });
    return '1.0.0';
  }
})();

const frontendIndexPath = path.join(projectRoot, 'dist', 'index.html');

function resolveFrontendBuildId() {
  if (process.env.APP_BUILD_ID) return process.env.APP_BUILD_ID;
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT;

  try {
    const stats = fs.statSync(frontendIndexPath);
    return String(Math.floor(stats.mtimeMs));
  } catch (error) {
    return appVersion;
  }
}

function resolveFrontendPublishedAt() {
  try {
    const stats = fs.statSync(frontendIndexPath);
    return new Date(stats.mtimeMs).toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

function setStaticCacheHeaders(res, filePath) {
  if (
    filePath.endsWith('index.html')
    || filePath.endsWith('manifest.json')
    || filePath.endsWith('service-worker.js')
    || filePath.endsWith('.svg')
  ) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
}

// =============================================================================
// CONFIGURACIÓN CORS
// =============================================================================
function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const configuredOrigins = [
  'http://localhost',
  'https://localhost',
  'http://localhost:5173',
  'https://localhost:5173',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
  'capacitor://localhost',
  'ionic://localhost',
  'https://matebudy.onrender.com',
  'https://matebudy-1.onrender.com',
  ...parseOrigins(process.env.CORS_ALLOWED_ORIGINS),
];

const allowAllOrigins = configuredOrigins.includes('*');
const allowedOrigins = [...new Set(configuredOrigins.filter((origin) => origin && origin !== '*'))];

function isOriginAllowed(origin) {
  if (!origin) return true; // Permitir si no hay origin (peticiones same-origin)
  return allowAllOrigins || allowedOrigins.includes(origin);
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      logger.warn('Origin rechazada por CORS', { origin, allowedOrigins });
      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-code'],
};

// =============================================================================
// CREACIÓN DEL SERVIDOR
// =============================================================================
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
});

// =============================================================================
// MIDDLEWARE
// =============================================================================
// Logging de peticiones HTTP
app.use(createExpressLogger(logger));

// Rate limiting general
app.use(rateLimiters.general);

// CORS
app.use(cors(corsOptions));

// Parsers
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_LIMIT }));
app.use(cookieParser());

// Servir archivos estáticos de uploads
const uploadsDir = path.join(projectRoot, 'uploads');
const legacyUploadsDir = path.join(projectRoot, 'server', 'uploads');

app.use('/uploads', express.static(uploadsDir));
if (legacyUploadsDir !== uploadsDir && fs.existsSync(legacyUploadsDir)) {
  app.use('/uploads', express.static(legacyUploadsDir));
}

// =============================================================================
// BACKUPS AUTOMÁTICOS
// =============================================================================
startAutoBackup();

// =============================================================================
// RUTAS DE SALUD Y ESTADO
// =============================================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend running correctly',
    version: appVersion,
    buildId: resolveFrontendBuildId(),
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Update JSON para auto-actualización
app.get('/update.json', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({
    version: process.env.APP_VERSION || appVersion,
    buildId: resolveFrontendBuildId(),
    publishedAt: resolveFrontendPublishedAt(),
    url: 'https://matebudy.onrender.com/Matebudy.apk',
    notes: 'La app recargara automaticamente el frontend cuando detecte un parche nuevo.',
    priority: 'high',
    nativeUpdate: process.env.APP_NATIVE_UPDATE_REQUIRED === 'true',
  });
});

// Servir APK
app.get(['/Matebudy.apk', '/matebudy.apk'], (req, res) => {
  const apkPath = path.join(projectRoot, 'server', 'Matebudy.apk');

  if (fs.existsSync(apkPath)) {
    res.download(apkPath, 'Matebudy.apk');
  } else {
    logger.warn('APK no encontrada', { apkPath });
    res.status(404).json({ error: 'APK no encontrado' });
  }
});

// =============================================================================
// RUTAS DE API (con rate limiting específico)
// =============================================================================

// Rutas de autenticación (rate limit estricto)
authRoutes(app, { rateLimiter: rateLimiters.login });

// Chat con WebSocket
chatRoutes(app, io);

// Otras rutas (rate limit estándar)
userRoutes(app);
postRoutes(app);
locationRoutes(app);
paymentRoutes(app);
sosRoutes(app);
adminRoutes(app);

// =============================================================================
// SERVICIO DE ARCHIVOS ESTÁTICOS (Frontend)
// =============================================================================
const distDir = path.join(projectRoot, 'dist');

if (fs.existsSync(distDir)) {
  logger.info('Sirviendo frontend desde dist/', { distDir });

  app.use((req, res, next) => {
    const filePath = path.join(distDir, req.path);
    setStaticCacheHeaders(res, filePath);
    next();
  });

  app.use(express.static(distDir));

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  logger.warn('Directorio dist/ no encontrado. El frontend no estará disponible.');
}

// =============================================================================
// MANEJO DE ERRORES
// =============================================================================

// 404 handler
app.use((req, res) => {
  logger.http('Ruta no encontrada', { method: req.method, url: req.url });
  res.status(404).json({ error: 'Not found' });
});

// Error handler global
app.use(createErrorHandler(logger));

// =============================================================================
// INICIO DEL SERVIDOR
// =============================================================================
httpServer.listen(PORT, HOST, () => {
  logger.info('🚀 Servidor iniciado', {
    host: HOST,
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    cors: allowedOrigins,
  });

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    MATEBUDY SERVER                        ║
╠═══════════════════════════════════════════════════════════╣
║  Host: ${HOST.padEnd(50)} ║
║  Puerto: ${String(PORT).padEnd(48)} ║
║  Entorno: ${(process.env.NODE_ENV || 'development').padEnd(45)} ║
║  Versión: ${appVersion.padEnd(47)} ║
╠═══════════════════════════════════════════════════════════╣
║  Health: http://${HOST}:${PORT}/api/health${' '.repeat(32 - HOST.length - String(PORT).length)} ║
║  Update: http://${HOST}:${PORT}/update.json${' '.repeat(31 - HOST.length - String(PORT).length)} ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// =============================================================================
// MANEJO DE SEÑALES
// =============================================================================
process.on('SIGTERM', () => {
  logger.info('Señal SIGTERM recibida, cerrando servidor...');
  httpServer.close(() => {
    logger.info('Servidor cerrado');
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Señal SIGINT recibida, cerrando servidor...');
  httpServer.close(() => {
    logger.info('Servidor cerrado');
    db.close();
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Excepción no capturada', { error: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesa no manejada', { reason: reason?.message || reason, promise });
});

// =============================================================================
// EXPORTS
// =============================================================================
export { app, io, httpServer };
export default httpServer;
