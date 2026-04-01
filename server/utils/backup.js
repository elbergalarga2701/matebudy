import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabasePath, backupsDir } from '../config/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sistema de backups automáticos de la base de datos
 */

/**
 * Crea un backup de la base de datos
 */
export async function createBackup() {
  const dbPath = getDatabasePath();
  
  if (!dbPath || !fs.existsSync(dbPath)) {
    console.warn('[Backup] Base de datos no encontrada, omitiendo backup');
    return null;
  }

  try {
    // Asegurar que el directorio de backups exista
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    // Nombre del archivo con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `matebudy-${timestamp}.sqlite.backup`;
    const backupPath = path.join(backupsDir, backupFileName);

    // Copiar archivo de base de datos
    await fs.promises.copyFile(dbPath, backupPath);

    console.log(`✅ [Backup] Backup creado: ${backupPath}`);

    // Limpiar backups antiguos (mantener últimos 7)
    await cleanupOldBackups();

    return backupPath;
  } catch (error) {
    console.error('❌ [Backup] Error creando backup:', error);
    throw error;
  }
}

/**
 * Limpia backups antiguos, manteniendo solo los últimos N backups
 */
async function cleanupOldBackups(keepCount = 7) {
  try {
    if (!fs.existsSync(backupsDir)) {
      return;
    }

    const files = await fs.promises.readdir(backupsDir);
    const backupFiles = files
      .filter(file => file.endsWith('.sqlite.backup'))
      .sort()
      .reverse();

    // Eliminar backups antiguos
    if (backupFiles.length > keepCount) {
      const toDelete = backupFiles.slice(keepCount);
      for (const file of toDelete) {
        const filePath = path.join(backupsDir, file);
        await fs.promises.unlink(filePath);
        console.log(`🗑️  [Backup] Backup antiguo eliminado: ${file}`);
      }
    }
  } catch (error) {
    console.error('[Backup] Error limpiando backups:', error);
  }
}

/**
 * Inicia el sistema de backups automáticos
 */
export function startAutoBackup() {
  const enabled = process.env.BACKUP_ENABLED !== 'false';
  const intervalHours = parseInt(process.env.BACKUP_INTERVAL_HOURS || '24', 10);

  if (!enabled) {
    console.log('🚫 [Backup] Backups automáticos deshabilitados');
    return null;
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`⏰ [Backup] Backups automáticos iniciados (cada ${intervalHours} horas)`);

  // Crear primer backup después de 1 minuto
  const initialTimeout = setTimeout(() => {
    createBackup().catch(console.error);
    
    // Luego ejecutar en el intervalo configurado
    setInterval(() => {
      createBackup().catch(console.error);
    }, intervalMs);
  }, 60000);

  return initialTimeout;
}

/**
 * Lista todos los backups disponibles
 */
export async function listBackups() {
  try {
    if (!fs.existsSync(backupsDir)) {
      return [];
    }

    const files = await fs.promises.readdir(backupsDir);
    const backupFiles = files.filter(file => file.endsWith('.sqlite.backup'));

    const backups = await Promise.all(
      backupFiles.map(async file => {
        const filePath = path.join(backupsDir, file);
        const stats = await fs.promises.stat(filePath);
        
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString(),
        };
      })
    );

    return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error('[Backup] Error listando backups:', error);
    return [];
  }
}

/**
 * Restaura un backup específico
 */
export async function restoreBackup(backupFilename) {
  const dbPath = getDatabasePath();
  
  if (!dbPath) {
    throw new Error('Ruta de base de datos no configurada');
  }

  const backupPath = path.join(backupsDir, backupFilename);
  
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup no encontrado: ${backupFilename}`);
  }

  try {
    // Crear backup del estado actual antes de restaurar
    if (fs.existsSync(dbPath)) {
      const preRestoreBackup = `${dbPath}.pre-restore-${Date.now()}`;
      await fs.promises.copyFile(dbPath, preRestoreBackup);
      console.log(`💾 [Backup] Backup pre-restauración creado: ${preRestoreBackup}`);
    }

    // Restaurar backup
    await fs.promises.copyFile(backupPath, dbPath);
    console.log(`✅ [Backup] Backup restaurado: ${backupFilename}`);

    return true;
  } catch (error) {
    console.error('❌ [Backup] Error restaurando backup:', error);
    throw error;
  }
}
