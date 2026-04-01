import db from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { verifyToken } from './auth.js';
import { uploadsDir } from '../paths.js';

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
  },
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

function formatMonitorLinkRequest(row, currentUserId) {
  const isIncoming = Number(row.target_user_id) === Number(currentUserId);
  const otherParty = {
    id: isIncoming ? row.monitor_id : row.target_id,
    name: isIncoming ? row.monitor_name : row.target_name,
    email: isIncoming ? row.monitor_email : row.target_email,
    role: isIncoming ? row.monitor_role : row.target_role,
    profession: isIncoming ? row.monitor_profession : row.target_profession,
    avatar: isIncoming ? row.monitor_avatar : row.target_avatar,
    manualStatus: isIncoming ? row.monitor_manual_status : row.target_manual_status,
    isOnline: Boolean(isIncoming ? row.monitor_is_online : row.target_is_online),
    lastSeen: isIncoming ? row.monitor_last_seen : row.target_last_seen,
  };

  return {
    id: row.id,
    note: row.note || '',
    status: row.status || 'pending',
    createdAt: row.created_at,
    respondedAt: row.responded_at || null,
    isIncoming,
    requesterId: row.monitor_user_id,
    targetUserId: row.target_user_id,
    user: otherParty,
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

async function getMonitorRequestsForUser(userId) {
  const rows = await allAsync(
    `SELECT
       mlr.*,
       monitor.id AS monitor_id,
       monitor.email AS monitor_email,
       monitor.role AS monitor_role,
       monitor.name AS monitor_name,
       monitor.profession AS monitor_profession,
       monitor.avatar AS monitor_avatar,
       monitor.manualStatus AS monitor_manual_status,
       monitor_presence.is_online AS monitor_is_online,
       monitor_presence.last_seen AS monitor_last_seen,
       target.id AS target_id,
       target.email AS target_email,
       target.role AS target_role,
       target.name AS target_name,
       target.profession AS target_profession,
       target.avatar AS target_avatar,
       target.manualStatus AS target_manual_status,
       target_presence.is_online AS target_is_online,
       target_presence.last_seen AS target_last_seen
     FROM monitor_link_requests mlr
     JOIN users monitor ON monitor.id = mlr.monitor_user_id
     JOIN users target ON target.id = mlr.target_user_id
     LEFT JOIN user_presence monitor_presence ON monitor_presence.user_id = monitor.id
     LEFT JOIN user_presence target_presence ON target_presence.user_id = target.id
     WHERE (mlr.monitor_user_id = ? OR mlr.target_user_id = ?)
     ORDER BY
       CASE WHEN mlr.status = 'pending' THEN 0 ELSE 1 END,
       mlr.created_at DESC`,
    [userId, userId],
  );

  return rows.map((row) => formatMonitorLinkRequest(row, userId));
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
      },
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
      },
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

  app.get('/api/users/monitor-link-requests', verifyToken, async (req, res) => {
    try {
      const requests = await getMonitorRequestsForUser(req.user.id);
      res.json({
        incoming: requests.filter((entry) => entry.isIncoming && entry.status === 'pending'),
        outgoing: requests.filter((entry) => !entry.isIncoming && entry.status === 'pending'),
        history: requests.filter((entry) => entry.status !== 'pending').slice(0, 20),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/users/monitor-link-requests', verifyToken, async (req, res) => {
    try {
      if (req.user.role !== 'monitor') {
        return res.status(403).json({ error: 'Solo las cuentas monitor pueden solicitar acceso de seguimiento' });
      }

      const targetUserId = Number(req.body.targetUserId);
      const note = String(req.body.note || '').trim();

      if (!targetUserId) return res.status(400).json({ error: 'Debes indicar a quien quieres monitorear' });
      if (targetUserId === Number(req.user.id)) return res.status(400).json({ error: 'No puedes monitorearte a ti mismo' });

      const targetUser = await getUserById(targetUserId);
      if (!targetUser || !targetUser.isVerified) {
        return res.status(404).json({ error: 'El perfil objetivo no esta disponible para monitoreo' });
      }

      const activeLink = await getAsync(
        `SELECT id
         FROM monitor_links
         WHERE monitor_user_id = ? AND target_user_id = ?`,
        [req.user.id, targetUserId],
      );
      if (activeLink) {
        return res.status(400).json({ error: 'Ese perfil ya tiene un vinculo de monitor activo' });
      }

      const existingPending = await getAsync(
        `SELECT id
         FROM monitor_link_requests
         WHERE monitor_user_id = ? AND target_user_id = ? AND status = 'pending'`,
        [req.user.id, targetUserId],
      );
      if (existingPending) {
        return res.status(400).json({ error: 'Ya enviaste una solicitud de monitoreo a este perfil' });
      }

      await runAsync(
        `INSERT INTO monitor_link_requests (monitor_user_id, target_user_id, note, status, created_at)
         VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
        [req.user.id, targetUserId, note || null],
      );

      res.status(201).json({ success: true, message: 'Solicitud enviada. El otro perfil debe aprobarla.' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/users/monitor-link-requests/:requestId/approve', verifyToken, async (req, res) => {
    try {
      const request = await getAsync(
        `SELECT *
         FROM monitor_link_requests
         WHERE id = ? AND target_user_id = ? AND status = 'pending'`,
        [req.params.requestId, req.user.id],
      );

      if (!request) {
        return res.status(404).json({ error: 'No se encontro una solicitud pendiente para aprobar' });
      }

      await runAsync(
        `INSERT OR IGNORE INTO monitor_links (monitor_user_id, target_user_id, created_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [request.monitor_user_id, request.target_user_id],
      );

      await runAsync(
        `UPDATE monitor_link_requests
         SET status = 'approved', responded_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [req.params.requestId],
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/users/monitor-link-requests/:requestId/reject', verifyToken, async (req, res) => {
    try {
      const request = await getAsync(
        `SELECT *
         FROM monitor_link_requests
         WHERE id = ? AND target_user_id = ? AND status = 'pending'`,
        [req.params.requestId, req.user.id],
      );

      if (!request) {
        return res.status(404).json({ error: 'No se encontro una solicitud pendiente para rechazar' });
      }

      await runAsync(
        `UPDATE monitor_link_requests
         SET status = 'rejected', responded_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [req.params.requestId],
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/users/monitor-link-requests/:requestId', verifyToken, async (req, res) => {
    try {
      const request = await getAsync(
        `SELECT *
         FROM monitor_link_requests
         WHERE id = ? AND status = 'pending'`,
        [req.params.requestId],
      );

      if (!request) {
        return res.status(404).json({ error: 'No se encontro una solicitud pendiente para cancelar' });
      }

      if (Number(request.monitor_user_id) !== Number(req.user.id) && Number(request.target_user_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'No puedes cancelar esta solicitud' });
      }

      await runAsync('DELETE FROM monitor_link_requests WHERE id = ?', [req.params.requestId]);
      res.json({ success: true });
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
           AND EXISTS (
             SELECT 1
             FROM monitor_link_requests mlr
             WHERE mlr.monitor_user_id = ml.monitor_user_id
               AND mlr.target_user_id = ml.target_user_id
               AND mlr.status = 'approved'
           )
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
    res.status(410).json({ error: 'El monitoreo ahora requiere solicitud y aprobacion explicita. Usa /api/users/monitor-link-requests.' });
  });

  app.delete('/api/users/monitor-links/:linkId', verifyToken, async (req, res) => {
    try {
      await runAsync(
        `DELETE FROM monitor_links
         WHERE id = ?
           AND (monitor_user_id = ? OR target_user_id = ?)`,
        [req.params.linkId, req.user.id, req.user.id],
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/users/verify-kyc', verifyToken, upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'document', maxCount: 1 },
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
