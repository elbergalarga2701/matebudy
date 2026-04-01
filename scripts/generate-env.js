#!/usr/bin/env node

/**
 * Script para generar un archivo .env seguro para MateBudy
 * Uso: node scripts/generate-env.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

console.log('🔐 Generando archivo .env seguro para MateBudy...\n');

// Verificar si ya existe un .env
if (fs.existsSync(envPath)) {
  console.warn('⚠️  ADVERTENCIA: El archivo .env ya existe.');
  console.warn('   Esto sobrescribirá tu configuración actual.\n');
  
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const answer = await new Promise(resolve => {
    rl.question('¿Estás seguro de continuar? (y/N): ', resolve);
    rl.close();
  });
  
  if (answer.toLowerCase() !== 'y') {
    console.log('❌ Operación cancelada.');
    process.exit(0);
  }
}

// Generar secrets seguros
const jwtSecret = crypto.randomBytes(64).toString('hex');
const jwtRefreshSecret = crypto.randomBytes(64).toString('hex');
const adminCode = crypto.randomBytes(8).toString('hex');

// Crear contenido del .env
const envContent = `# =============================================================================
# MATEBUDY - Variables de Entorno
# =============================================================================
# Generado: ${new Date().toISOString()}
# ADVERTENCIA: Este archivo contiene secretos sensibles. No lo compartas.
# =============================================================================

# -----------------------------------------------------------------------------
# SEGURIDAD (CRÍTICO - No compartir)
# -----------------------------------------------------------------------------
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}

# -----------------------------------------------------------------------------
# CONFIGURACION DEL SERVIDOR
# -----------------------------------------------------------------------------
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
JSON_LIMIT=10mb
ADMIN_PANEL_CODE=${adminCode}

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
# FIREBASE (Opcional - Dejar vacío si no se usa)
# -----------------------------------------------------------------------------
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=

# -----------------------------------------------------------------------------
# MAPAS (Opcional - Dejar vacío si no se usa)
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

// Escribir archivo
fs.writeFileSync(envPath, envContent, 'utf8');

console.log('✅ Archivo .env generado exitosamente\n');
console.log('📁 Ubicación:', envPath);
console.log('\n🔒 Secrets generados:');
console.log('   - JWT_SECRET: ✅');
console.log('   - JWT_REFRESH_SECRET: ✅');
console.log('   - ADMIN_PANEL_CODE: ✅');
console.log('\n⚠️  IMPORTANTE:');
console.log('   1. Este archivo contiene secretos sensibles');
console.log('   2. No lo compartas ni lo subas al repositorio');
console.log('   3. Para producción, genera nuevos secrets únicos');
console.log('   4. El archivo .gitignore ya excluye este archivo');
console.log('\n🚀 Para iniciar el servidor:');
console.log('   npm install');
console.log('   npm run dev');
console.log('');
