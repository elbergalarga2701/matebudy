import db from '../db.js';

const DEFAULT_ADMIN_CODE = process.env.ADMIN_PANEL_CODE || 'matebudy-admin-uy';

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
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

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function isMonitorRole(role) {
  return role === 'monitor' || role === 'provider';
}

function formatUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isVerified: Boolean(row.isVerified),
    verificationStatus: row.verificationStatus || 'pending',
    onboardingCompleted: Boolean(row.onboardingCompleted),
    profileStatus: row.profileStatus || 'pendiente',
    name: row.name || 'Usuario',
    profileAnswers: parseJson(row.profileAnswers, {}),
    verificationData: parseJson(row.verificationData, null),
    verificationReview: parseJson(row.verificationReview, null),
    createdAt: row.created_at,
  };
}

function requireAdminCode(req, res, next) {
  const code = req.headers['x-admin-code'];
  if (!code || code !== DEFAULT_ADMIN_CODE) {
    return res.status(403).json({ error: 'Codigo administrativo invalido' });
  }

  next();
}

export const adminRoutes = (app) => {
  app.get('/api/admin/verification-queue', requireAdminCode, async (req, res) => {
    try {
      const rows = await allAsync(
        `SELECT * FROM users
         WHERE verificationStatus = ?
         ORDER BY created_at ASC`,
        ['under_review'],
      );

      res.json({ queue: rows.map((row) => formatUser(row)) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/verification-decision', requireAdminCode, async (req, res) => {
    try {
      const { userId, decision, notes = '' } = req.body;
      if (!userId) return res.status(400).json({ error: 'userId es obligatorio' });
      if (!['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ error: 'Decision invalida' });
      }

      const currentUser = await getAsync('SELECT * FROM users WHERE id = ?', [userId]);
      if (!currentUser) return res.status(404).json({ error: 'Usuario no encontrado' });

      const nextProfileStatus = decision === 'approved'
        ? isMonitorRole(currentUser.role)
          ? 'activo'
          : 'en configuracion'
        : 'rechazado';
      const nextOnboarding = decision === 'approved' && isMonitorRole(currentUser.role)
        ? 1
        : currentUser.onboardingCompleted;
      const reviewPayload = JSON.stringify({
        decision,
        notes,
        reviewedAt: new Date().toISOString(),
      });

      await runAsync(
        `UPDATE users
         SET isVerified = ?,
             verificationStatus = ?,
             profileStatus = ?,
             onboardingCompleted = ?,
             verificationReview = ?
         WHERE id = ?`,
        [
          decision === 'approved' ? 1 : 0,
          decision,
          nextProfileStatus,
          nextOnboarding,
          reviewPayload,
          userId,
        ],
      );

      const updated = await getAsync('SELECT * FROM users WHERE id = ?', [userId]);
      res.json({ success: true, user: formatUser(updated) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/settings/payment', requireAdminCode, async (req, res) => {
    try {
      const rows = await allAsync(
        `SELECT key, value FROM app_settings
         WHERE key IN (?, ?, ?, ?, ?, ?, ?)`,
        [
          'mp_environment',
          'mp_public_key',
          'mp_access_token',
          'mp_webhook_url',
          'mp_success_url',
          'mp_pending_url',
          'mp_failure_url',
        ],
      );

      const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));

      res.json({
        mpEnvironment: settings.mp_environment || process.env.MP_ENVIRONMENT || 'test',
        mpPublicKey: settings.mp_public_key || process.env.MP_PUBLIC_KEY || '',
        mpAccessToken: settings.mp_access_token || process.env.MP_ACCESS_TOKEN || '',
        mpWebhookUrl: settings.mp_webhook_url || process.env.MP_WEBHOOK_URL || '',
        mpSuccessUrl: settings.mp_success_url || process.env.MP_SUCCESS_URL || 'http://localhost:5173/chat?payment=success',
        mpPendingUrl: settings.mp_pending_url || process.env.MP_PENDING_URL || 'http://localhost:5173/chat?payment=pending',
        mpFailureUrl: settings.mp_failure_url || process.env.MP_FAILURE_URL || 'http://localhost:5173/chat?payment=failure',
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/settings/payment', requireAdminCode, async (req, res) => {
    try {
      const entries = [
        ['mp_environment', req.body.mpEnvironment || 'test'],
        ['mp_public_key', req.body.mpPublicKey || ''],
        ['mp_access_token', req.body.mpAccessToken || ''],
        ['mp_webhook_url', req.body.mpWebhookUrl || ''],
        ['mp_success_url', req.body.mpSuccessUrl || ''],
        ['mp_pending_url', req.body.mpPendingUrl || ''],
        ['mp_failure_url', req.body.mpFailureUrl || ''],
      ];

      for (const [key, value] of entries) {
        await runAsync(
          `INSERT INTO app_settings (key, value, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
          [key, value],
        );
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
