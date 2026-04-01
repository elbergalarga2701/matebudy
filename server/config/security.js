import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');

// Cargar .env si existe
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

/**
 * Verifica que las variables de entorno críticas estén configuradas
 * y genera valores seguros si es necesario
 */
export function ensureSecureConfig() {
  const warnings = [];
  let generated = false;

  // Verificar JWT_SECRET - Generar automaticamente si no existe
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('matebudy_')) {
    warnings.push('JWT_SECRET no configurada, generando valor automatico');
    process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
    generated = true;
  }

  // Verificar JWT_REFRESH_SECRET - Generar automaticamente si no existe
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.startsWith('refresh_')) {
    warnings.push('JWT_REFRESH_SECRET no configurada, generando valor automatico');
    process.env.JWT_REFRESH_SECRET = crypto.randomBytes(64).toString('hex');
    generated = true;
  }

  // Verificar ADMIN_PANEL_CODE - Generar valor por defecto si no existe
  if (!process.env.ADMIN_PANEL_CODE) {
    warnings.push('ADMIN_PANEL_CODE no configurada, usando valor por defecto');
    process.env.ADMIN_PANEL_CODE = 'matebudy-admin-2026';
    generated = true;
  }

  // Mostrar warnings
  warnings.forEach(warning => {
    console.warn(`⚠️  [SECURITY] ${warning}`);
  });

  if (generated) {
    console.log('⚙️  [SECURITY] Variables generadas automaticamente para produccion');
    console.log('   NOTA: Configura variables personalizadas en Render Dashboard para mayor seguridad');
  }

  console.log('✅ [SECURITY] Configuración verificada correctamente');
}

/**
 * Genera un archivo .env con valores seguros
 */
export function generateSecureEnv() {
  const envTemplate = `# =============================================================================
# MATEBUDY - Variables de Entorno (Generado automáticamente)
# =============================================================================
# Generado: ${new Date().toISOString()}
# ADVERTENCIA: Este archivo contiene secretos sensibles. No lo compartas.
# =============================================================================

# -----------------------------------------------------------------------------
# SEGURIDAD (Generados automáticamente)
# -----------------------------------------------------------------------------
JWT_SECRET=${crypto.randomBytes(64).toString('hex')}
JWT_REFRESH_SECRET=${crypto.randomBytes(64).toString('hex')}

# -----------------------------------------------------------------------------
# CONFIGURACION DEL SERVIDOR
# -----------------------------------------------------------------------------
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
JSON_LIMIT=10mb
ADMIN_PANEL_CODE=${crypto.randomBytes(8).toString('hex')}

# -----------------------------------------------------------------------------
# CORS
# -----------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# -----------------------------------------------------------------------------
# BASE DE DATOS
# -----------------------------------------------------------------------------
DATABASE_URL=sqlite://./matebudy.sqlite

# -----------------------------------------------------------------------------
# FRONTEND
# -----------------------------------------------------------------------------
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
VITE_UPDATE_URL=http://localhost:3000/update.json

# -----------------------------------------------------------------------------
# TOKENS
# -----------------------------------------------------------------------------
JWT_ACCESS_TTL=7d
JWT_REFRESH_TTL=30d
JWT_ACCESS_MAX_AGE_MS=604800000
JWT_REFRESH_MAX_AGE_MS=2592000000

# -----------------------------------------------------------------------------
# REGISTRO
# -----------------------------------------------------------------------------
REGISTRATION_RETRY_ATTEMPTS=5
REGISTRATION_RETRY_DELAY_MS=150

# -----------------------------------------------------------------------------
# COOKIES
# -----------------------------------------------------------------------------
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_DOMAIN=

# -----------------------------------------------------------------------------
# PAGOS (Mercado Pago)
# -----------------------------------------------------------------------------
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_PUBLIC_KEY=
MERCADO_PAGO_WEBHOOK_SECRET=
PLATFORM_COMMISSION_RATE=0.15
PLATFORM_COMMISSION_MIN=0.05
PLATFORM_COMMISSION_MAX=0.10

# -----------------------------------------------------------------------------
# FIREBASE (Opcional)
# -----------------------------------------------------------------------------
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=

# -----------------------------------------------------------------------------
# MAPAS
# -----------------------------------------------------------------------------
GOOGLE_MAPS_API_KEY=
MAPBOX_ACCESS_TOKEN=

# -----------------------------------------------------------------------------
# ARCHIVOS
# -----------------------------------------------------------------------------
MAX_FILE_SIZE=8388608
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf

# -----------------------------------------------------------------------------
# RATE LIMITING
# -----------------------------------------------------------------------------
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_REGISTER_MAX=10

# -----------------------------------------------------------------------------
# BACKUPS
# -----------------------------------------------------------------------------
BACKUP_ENABLED=true
BACKUP_INTERVAL_HOURS=24
BACKUP_DIR=./backups

# -----------------------------------------------------------------------------
# LOGGING
# -----------------------------------------------------------------------------
LOG_LEVEL=info
LOG_FILE=./logs/server.log

# -----------------------------------------------------------------------------
# ACTUALIZACION
# -----------------------------------------------------------------------------
APP_VERSION=1.0.0
APP_NATIVE_UPDATE_REQUIRED=false
`;

  if (fs.existsSync(envPath)) {
    console.warn('⚠️  El archivo .env ya existe. Se creará .env.generated en su lugar.');
    const generatedPath = path.join(__dirname, '..', '.env.generated');
    fs.writeFileSync(generatedPath, envTemplate, 'utf8');
    console.log(`✅ Archivo generado: ${generatedPath}`);
    console.log('   Revisa el archivo y renómbralo a .env si es necesario.');
  } else {
    fs.writeFileSync(envPath, envTemplate, 'utf8');
    console.log('✅ Archivo .env generado con valores seguros');
    console.log('   ⚠️  IMPORTANTE: Guarda este archivo en un lugar seguro y no lo compartas.');
  }
}

/**
 * Obtiene el JWT_SECRET de forma segura
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no configurada');
  }
  return secret;
}

/**
 * Obtiene el JWT_REFRESH_SECRET de forma segura
 */
export function getJwtRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET no configurada');
  }
  return secret;
}

/**
 * Obtiene el código de admin de forma segura
 */
export function getAdminCode() {
  const code = process.env.ADMIN_PANEL_CODE;
  if (!code) {
    throw new Error('ADMIN_PANEL_CODE no configurada');
  }
  return code;
}
