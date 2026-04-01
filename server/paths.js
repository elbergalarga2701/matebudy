/**
 * Paths.js - Compatibilidad con código legacy
 * Redirige a la configuración centralizada en config/paths.js
 */

export {
    projectRootDir as projectRoot,
    projectRootDir as projectUploadsDir,
    uploadsDir,
    serverUploadsDir as legacyUploadsDir,
    serverUploadsDir,
    backupsDir,
    logsDir,
    dbPath,
    apkPath,
    ensureDirectories,
    getPreferredUploadsDir,
    getDatabasePath,
    getApkPath,
} from './config/paths.js';

// Alias para compatibilidad
export const serverRoot = globalThis.__dirname || process.cwd();
