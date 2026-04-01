import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

/**
 * Configuración centralizada de rutas de uploads
 * Elimina inconsistencias entre diferentes módulos
 */

// Directorio raíz del proyecto
export const projectRootDir = projectRoot;

// Directorio principal de uploads (relativo al proyecto)
export const uploadsDir = path.join(projectRoot, 'uploads');

// Directorio de uploads legacy (para compatibilidad)
export const legacyUploadsDir = path.join(projectRoot, 'server', 'uploads');

// Directorio de uploads de la raíz del servidor
export const serverUploadsDir = path.join(projectRoot, 'server', 'uploads');

// Directorio de backups
export const backupsDir = path.join(projectRoot, process.env.BACKUP_DIR || 'backups');

// Directorio de logs
export const logsDir = path.join(projectRoot, 'logs');

// Archivos específicos
export const dbPath = path.join(projectRoot, 'matebudy.sqlite');
export const apkPath = path.join(projectRoot, 'server', 'Matebudy.apk');

/**
 * Asegura que todos los directorios necesarios existan
 */
export function ensureDirectories() {
  const directories = [
    uploadsDir,
    legacyUploadsDir,
    serverUploadsDir,
    backupsDir,
    logsDir,
  ];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Directorio creado: ${dir}`);
    }
  }
}

/**
 * Obtiene la ruta de upload preferida
 * Prioriza el directorio principal de uploads
 */
export function getPreferredUploadsDir() {
  // Si existe el directorio principal de uploads, usarlo
  if (fs.existsSync(uploadsDir)) {
    return uploadsDir;
  }
  
  // Si existe el directorio legacy, usarlo
  if (fs.existsSync(legacyUploadsDir)) {
    return legacyUploadsDir;
  }
  
  // Crear el directorio principal
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  return uploadsDir;
}

/**
 * Obtiene la ruta de la base de datos
 */
export function getDatabasePath() {
  // Si hay DATABASE_URL externa, usarla
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sqlite')) {
    return null; // Usar conexión externa
  }
  
  // Verificar rutas posibles para SQLite
  const possiblePaths = [
    dbPath,
    path.join(projectRoot, 'server', 'matebudy.sqlite'),
    path.join(process.cwd(), 'matebudy.sqlite'),
  ];
  
  for (const dbPath of possiblePaths) {
    if (fs.existsSync(dbPath)) {
      return dbPath;
    }
  }
  
  // Retornar la ruta por defecto
  return dbPath;
}

/**
 * Obtiene la ruta del APK
 */
export function getApkPath() {
  const possiblePaths = [
    apkPath,
    path.join(projectRoot, 'Matebudy.apk'),
    path.join(projectRoot, 'dist', 'Matebudy.apk'),
  ];
  
  for (const apkPath of possiblePaths) {
    if (fs.existsSync(apkPath)) {
      return apkPath;
    }
  }
  
  return null;
}
