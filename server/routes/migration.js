import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { uploadsDir } from '../paths.js';
import { restoreSqliteSnapshot } from '../utils/bootstrapRestore.js';

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const migrationTempDir = path.join(uploadsDir, 'migration-tmp');
if (!fs.existsSync(migrationTempDir)) {
  fs.mkdirSync(migrationTempDir, { recursive: true });
}

const upload = multer({
  dest: migrationTempDir,
  limits: {
    fileSize: 32 * 1024 * 1024,
  },
});

function removeTempFile(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, () => { });
}

function detectStatusCode(message) {
  if (/no encontrado|no se puede restaurar|no coincide/i.test(message)) return 400;
  if (/ya no esta permitida/i.test(message)) return 403;
  return 500;
}

export const migrationRoutes = (app) => {
  // Endpoint temporal para restaurar la base productiva de Railway
  // con el snapshot local validado durante la migracion Render -> Railway.
  app.post('/api/system/bootstrap-restore', upload.single('backup'), async (req, res) => {
    if (!req.file?.path) {
      return res.status(400).json({ error: 'Debes adjuntar un archivo backup' });
    }

    try {
      const result = await restoreSqliteSnapshot({
        snapshotPath: req.file.path,
      });

      res.json({
        success: true,
        snapshotHash: result.snapshotHash,
        finalUserCount: result.finalUserCount,
        importedCounts: result.importedCounts,
        backupCreated: result.createdBackupPath,
      });
    } catch (error) {
      res.status(detectStatusCode(String(error?.message || ''))).json({
        error: String(error?.message || 'No se pudo restaurar la base'),
      });
    } finally {
      removeTempFile(req.file?.path);
    }
  });
};
