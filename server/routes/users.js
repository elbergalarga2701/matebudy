import db from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { verifyToken } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, process.env.UPLOADS_DIR || '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '') || '';
    const safeExtension = extension.replace(/[^.\w-]/g, '').toLowerCase();
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExtension}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo imagenes o PDF permitidos'));
    }
  }
});

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function fileUrl(file) {
  if (!file) return null;
  return `/uploads/${path.basename(file.path)}`;
}

function formatUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    rate: row.rate || 0,
    isVerified: Boolean(row.isVerified),
    verificationStatus: row.verificationStatus || 'pending',
    onboardingCompleted: Boolean(row.onboardingCompleted),
    profileStatus: row.profileStatus || 'pendiente',
    name: row.name || 'Usuario',
    profession: row.profession || '',
    about: row.about || '',
    tags: parseJson(row.tags, []),
    avatar: row.avatar || '',
    manualStatus: row.manualStatus || 'en_linea',
    isOnline: Boolean(row.is_online),
    lastSeen: row.last_seen || null,
    profileAnswers: parseJson(row.profileAnswers, {}),
    verificationData: parseJson(row.verificationData, null),
    verificationReview: parseJson(row.verificationReview, null),
    created_at: row.created_at,
  };
}

function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function buildSearchClause(search) {
  const value = String(search || '').trim().toLowerCase();
  if (!value) return { clause: '', params: [] };
  return {
    clause: 'AND (LOWER(u.name) LIKE ? OR LOWER(u.profession) LIKE ? OR LOWER(u.about) LIKE ?)',
    params: [`%${value}%`, `%${value}%`, `%${value}%`],
  };
}

export const userRoutes = (app) => {
  app.get('/api/users', verifyToken, (req, res) => {
    db.all(
      `SELECT u.*, up.is_online, up.last_seen
       FROM users u
       LEFT JOIN user_presence up ON up.user_id = u.id
       WHERE u.id != ?`,
      [req.user.id],
      (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ users: users.map((user) => formatUser(user)) });
      }
    );
  });

  app.get('/api/users/profile', verifyToken, (req, res) => {
    db.get(
      `SELECT u.*, up.is_online, up.last_seen
       FROM users u
       LEFT JOIN user_presence up ON up.user_id = u.id
       WHERE u.id = ?`,
      [req.user.id],
      (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ user: formatUser(user) });
      }
    );
  });

  app.put('/api/users/profile', verifyToken, async (req, res) => {
    try {
      const currentUser = await getUserById(req.user.id);
      if (!currentUser) return res.status(404).json({ error: 'Usuario no encontrado' });

      const {
        name,
        profession,
        about,
        tags,
        avatar,
        profileAnswers,
        onboardingCompleted,
        profileStatus,
        manualStatus,
      } = req.body;

      await runAsync(
        `UPDATE users
         SET name = ?, profession = ?, about = ?, tags = ?, avatar = ?,
             profileAnswers = ?, onboardingCompleted = ?, profileStatus = ?, manualStatus = ?
         WHERE id = ?`,
        [
          name ?? currentUser.name,
          profession ?? currentUser.profession,
          about ?? currentUser.about,
          JSON.stringify(tags ?? parseJson(currentUser.tags, [])),
          avatar ?? currentUser.avatar,
          JSON.stringify(profileAnswers ?? parseJson(currentUser.profileAnswers, {})),
          onboardingCompleted === undefined ? currentUser.onboardingCompleted : Number(Boolean(onboardingCompleted)),
          profileStatus ?? currentUser.profileStatus,
          manualStatus ?? currentUser.manualStatus ?? 'en_linea',
          req.user.id,
        ],
      );

      const refreshed = await getAsync(
        `SELECT u.*, up.is_online, up.last_seen
         FROM users u
         LEFT JOIN user_presence up ON up.user_id = u.id
         WHERE u.id = ?`,
        [req.user.id],
      );
      res.json({ success: true, user: formatUser(refreshed) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/users/presence', verifyToken, async (req, res) => {
    try {
      const isOnline = req.body.isOnline === undefined ? true : Boolean(req.body.isOnline);
      const location = req.body.location || null;
      const batteryLevel = req.body.batteryLevel ?? null;

      await runAsync(
        `INSERT INTO user_presence (user_id, is_online, last_seen)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           is_online = excluded.is_online,
           last_seen = CURRENT_TIMESTAMP`,
        [req.user.id, Number(isOnline)],
      );

      if (location && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng))) {
        await runAsync(
          `INSERT INTO locations (user_id, lat, lng, battery_level, accuracy, updated_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET
             lat = excluded.lat,
             lng = excluded.lng,
             battery_level = excluded.battery_level,
             accuracy = excluded.accuracy,
             updated_at = CURRENT_TIMESTAMP`,
          [
            req.user.id,
            Number(location.lat),
            Number(location.lng),
            batteryLevel === null ? null : Number(batteryLevel),
            location.accuracy === undefined ? null : Number(location.accuracy),
          ],
        );
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/users/search', verifyToken, async (req, res) => {
    try {
      const { clause, params } = buildSearchClause(req.query.q);
      const rows = await allAsync(
        `SELECT u.*, up.is_online, up.last_seen
         FROM users u
         LEFT JOIN user_presence up ON up.user_id = u.id
         WHERE u.id != ?
           AND u.isVerified = 1
           ${clause}
         ORDER BY up.is_online DESC, u.name ASC
         LIMIT 30`,
        [req.user.id, ...params],
      );
      res.json({ users: rows.map((row) => formatUser(row)) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/users/known-contacts', verifyToken, async (req, res) => {
    try {
      const { clause, params } = buildSearchClause(req.query.q);
      const rows = await allAsync(
        `SELECT DISTINCT u.*, up.is_online, up.last_seen
         FROM users u
         LEFT JOIN user_presence up ON up.user_id = u.id
         WHERE u.id IN (
           SELECT CASE
             WHEN t.client_id = ? THEN t.provider_id
             ELSE t.client_id
           END
           FROM transactions t
           WHERE t.client_id = ? OR t.provider_id = ?
           UNION
           SELECT ml.target_user_id FROM monitor_links ml WHERE ml.monitor_user_id = ?
           UNION
           SELECT ml.monitor_user_id FROM monitor_links ml WHERE ml.target_user_id = ?
           UNION
           SELECT DISTINCT m.sender_id
           FROM messages m
           WHERE m.sender_id != ?
             AND (
               m.room_id LIKE ? OR
               m.room_id LIKE ?
             )
         )
         ${clause}
         ORDER BY up.is_online DESC, u.name ASC
         LIMIT 50`,
        [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, `%${req.user.id}_%`, `%_${req.user.id}%`, ...params],
      );
      res.json({ users: rows.map((row) => formatUser(row)) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/users/monitor-links', verifyToken, async (req, res) => {
    try {
      const rows = await allAsync(
        `SELECT
           ml.id,
           u.*,
           up.is_online,
           up.last_seen,
           l.lat,
           l.lng,
           l.battery_level,
           l.updated_at AS location_updated_at
         FROM monitor_links ml
         JOIN users u ON u.id = ml.target_user_id
         LEFT JOIN user_presence up ON up.user_id = u.id
         LEFT JOIN locations l ON l.user_id = u.id
         WHERE ml.monitor_user_id = ?
         ORDER BY ml.created_at DESC`,
        [req.user.id],
      );

      res.json({
        links: rows.map((row) => ({
          id: row.id,
          target: formatUser(row),
          location: row.lat === null || row.lat === undefined ? null : {
            lat: Number(row.lat),
            lng: Number(row.lng),
            batteryLevel: row.battery_level === null || row.battery_level === undefined ? null : Number(row.battery_level),
            updatedAt: row.location_updated_at || null,
          },
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/users/monitor-links', verifyToken, async (req, res) => {
    try {
      const targetUserId = Number(req.body.targetUserId);
      if (!targetUserId) return res.status(400).json({ error: 'Debes indicar a quien quieres monitorear' });
      if (targetUserId === Number(req.user.id)) return res.status(400).json({ error: 'No puedes monitorearte a ti mismo' });

      await runAsync(
        `INSERT INTO monitor_links (monitor_user_id, target_user_id, created_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [req.user.id, targetUserId],
      );
      res.json({ success: true });
    } catch (error) {
      if (/UNIQUE/i.test(error.message)) {
        return res.status(400).json({ error: 'Ese perfil ya esta vinculado a tu monitor' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/users/monitor-links/:linkId', verifyToken, async (req, res) => {
    try {
      await runAsync(
        'DELETE FROM monitor_links WHERE id = ? AND monitor_user_id = ?',
        [req.params.linkId, req.user.id],
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/users/verify-kyc', verifyToken, upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'document', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const { documentType, documentNumber } = req.body;
      const selfieFile = req.files?.selfie?.[0];
      const documentFile = req.files?.document?.[0];

      if (!selfieFile || !documentFile) {
        return res.status(400).json({ error: 'Debes subir una selfie y un documento' });
      }

      if (!['ci', 'passport'].includes(documentType)) {
        return res.status(400).json({ error: 'Selecciona cedula o pasaporte' });
      }

      const cleanNumber = String(documentNumber || '').trim();
      const isCiValid = documentType === 'ci' && /^\d{7,8}$/.test(cleanNumber);
      const isPassportValid = documentType === 'passport' && /^[A-Za-z0-9]{6,9}$/.test(cleanNumber);

      if (!isCiValid && !isPassportValid) {
        return res.status(400).json({ error: 'Ingresa un numero de documento uruguayo valido' });
      }

      const verificationData = {
        documentType,
        documentNumber: cleanNumber,
        selfieType: selfieFile.mimetype,
        documentTypeMime: documentFile.mimetype,
        selfieName: selfieFile.originalname,
        documentName: documentFile.originalname,
        selfiePreview: fileUrl(selfieFile),
        documentPreview: documentFile.mimetype === 'application/pdf' ? null : fileUrl(documentFile),
        documentFileUrl: fileUrl(documentFile),
        submittedAt: new Date().toISOString(),
        country: 'UY',
      };

      await runAsync(
        `UPDATE users
         SET isVerified = 0,
             verificationStatus = ?,
             profileStatus = ?,
             verificationData = ?,
             verificationReview = NULL
         WHERE id = ?`,
        ['under_review', 'revision de identidad', JSON.stringify(verificationData), req.user.id],
      );

      const refreshed = await getUserById(req.user.id);
      res.json({
        verified: false,
        message: 'Documentos enviados a revision',
        user: formatUser(refreshed),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/users/verify-kyc/reset', verifyToken, async (req, res) => {
    try {
      await runAsync(
        `UPDATE users
         SET isVerified = 0,
             verificationStatus = ?,
             profileStatus = ?,
             verificationData = NULL,
             verificationReview = NULL
         WHERE id = ?`,
        ['pending', 'pendiente', req.user.id],
      );

      const refreshed = await getUserById(req.user.id);
      res.json({ success: true, user: formatUser(refreshed) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
