import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db.js';
import { validateStrongPassword } from '../passwordRules.js';
import { uploadsDir } from '../paths.js';
import { getJwtSecret, getJwtRefreshSecret } from '../config/security.js';

// Obtener secrets de forma segura (lanzan error si no están configurados)
const JWT_SECRET = getJwtSecret();
const JWT_REFRESH_SECRET = getJwtRefreshSecret();
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL || '7d';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TTL || '30d';
const ACCESS_TOKEN_MAX_AGE_MS = Number(process.env.JWT_ACCESS_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000);
const REFRESH_TOKEN_MAX_AGE_MS = Number(process.env.JWT_REFRESH_MAX_AGE_MS || 30 * 24 * 60 * 60 * 1000);
const SQLITE_BUSY_PATTERN = /SQLITE_BUSY|database is locked/i;
const REGISTRATION_RETRY_ATTEMPTS = Number(process.env.REGISTRATION_RETRY_ATTEMPTS || 5);
const REGISTRATION_RETRY_DELAY_MS = Number(process.env.REGISTRATION_RETRY_DELAY_MS || 150);
let registrationQueue = Promise.resolve();

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

function authCookieOptions(maxAge) {
  const sameSite = process.env.AUTH_COOKIE_SAMESITE
    || (process.env.NODE_ENV === 'production' ? 'none' : 'lax');

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite,
    maxAge,
  };
}

function fileUrl(file) {
  if (!file) return null;
  return `/uploads/${path.basename(file.path)}`;
}

function safeUnlink(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, () => { });
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function validateDocument(documentType, documentNumber) {
  if (!['ci', 'passport'].includes(documentType)) {
    return 'Selecciona cedula o pasaporte';
  }

  const cleanNumber = String(documentNumber || '').trim();
  const isCiValid = documentType === 'ci' && /^\d{7,8}$/.test(cleanNumber);
  const isPassportValid = documentType === 'passport' && /^[A-Za-z0-9]{6,9}$/.test(cleanNumber);

  if (!isCiValid && !isPassportValid) {
    return 'Ingresa un numero de documento uruguayo valido';
  }

  return null;
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

function buildTokens(user) {
  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
  return { token, refreshToken };
}

function attachAuthCookies(res, token, refreshToken) {
  res.cookie('token', token, authCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
  res.cookie('refreshToken', refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE_MS));
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function enqueueRegistration(task) {
  const pendingTask = registrationQueue
    .catch(() => null)
    .then(task);

  registrationQueue = pendingTask.catch(() => null);
  return pendingTask;
}

async function withSqliteBusyRetry(task) {
  let attempt = 0;

  while (attempt < REGISTRATION_RETRY_ATTEMPTS) {
    try {
      return await task();
    } catch (error) {
      attempt += 1;

      if (!SQLITE_BUSY_PATTERN.test(String(error?.message || '')) || attempt >= REGISTRATION_RETRY_ATTEMPTS) {
        throw error;
      }

      await wait(REGISTRATION_RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error('No se pudo completar la operacion');
}

function runRegistrationWrite(task) {
  return enqueueRegistration(() => withSqliteBusyRetry(task));
}

function mapRegistrationError(error) {
  const message = String(error?.message || '');

  if (/SQLITE_CONSTRAINT/i.test(message)) {
    return { status: 400, error: 'Email ya registrado' };
  }

  if (/SQLITE_BUSY|database is locked/i.test(message)) {
    return { status: 503, error: 'El sistema esta procesando otras altas. Intenta nuevamente en unos segundos.' };
  }

  return { status: 500, error: 'Error interno' };
}

export const verifyToken = (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token && req.cookies) {
    token = req.cookies.token;
  }

  if (!token) return res.status(403).json({ error: 'Token requerido' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token invalido' });
    req.user = decoded;
    next();
  });
};

export const authRoutes = (app) => {
  app.post('/api/auth/register-with-identity', upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'document', maxCount: 1 },
  ]), async (req, res) => {
    const {
      email,
      password,
      role,
      rate,
      name,
      profession,
      about,
      tags,
      avatar,
      documentType,
      documentNumber,
    } = req.body;

    const cleanEmail = String(email || '').trim().toLowerCase();
    const selfieFile = req.files?.selfie?.[0];
    const documentFile = req.files?.document?.[0];

    if (!cleanEmail || !password || !name) {
      safeUnlink(selfieFile?.path);
      safeUnlink(documentFile?.path);
      return res.status(400).json({ error: 'Completa nombre, correo y contrasena' });
    }

    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      safeUnlink(selfieFile?.path);
      safeUnlink(documentFile?.path);
      return res.status(400).json({ error: passwordError });
    }

    if (!selfieFile || !documentFile) {
      safeUnlink(selfieFile?.path);
      safeUnlink(documentFile?.path);
      return res.status(400).json({ error: 'Debes subir una selfie y un documento' });
    }

    const documentError = validateDocument(documentType, documentNumber);
    if (documentError) {
      safeUnlink(selfieFile?.path);
      safeUnlink(documentFile?.path);
      return res.status(400).json({ error: documentError });
    }

    try {
      const hash = await bcrypt.hash(password, 12);
      const cleanNumber = String(documentNumber || '').trim();
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

      const createdUser = await runRegistrationWrite(async () => {
        const insertResult = await runAsync(
          `INSERT INTO users (
            email, password, role, rate, name, profession, about, tags, avatar,
            isVerified, verificationStatus, profileStatus, verificationData, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            cleanEmail,
            hash,
            role || 'client',
            rate || 0,
            name || 'Usuario',
            profession || '',
            about || '',
            JSON.stringify(tags || []),
            typeof avatar === 'string' && avatar.length <= 500000 ? avatar : '',
            'under_review',
            'revision de identidad',
            JSON.stringify(verificationData),
          ],
        );

        const nextCreatedUser = await getAsync('SELECT * FROM users WHERE id = ?', [insertResult.lastID]);
        if (nextCreatedUser) {
          return nextCreatedUser;
        }

        await runAsync('DELETE FROM users WHERE id = ?', [insertResult.lastID]).catch(() => null);
        throw new Error('No se pudo cargar el usuario creado');
      });

      const { token, refreshToken } = buildTokens(createdUser);
      attachAuthCookies(res, token, refreshToken);

      res.status(201).json({
        token,
        user: formatUser(createdUser),
      });
    } catch (error) {
      safeUnlink(selfieFile?.path);
      safeUnlink(documentFile?.path);

      const mapped = mapRegistrationError(error);
      res.status(mapped.status).json({ error: mapped.error });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    const {
      email,
      password,
      role,
      rate,
      name,
      profession,
      about,
      tags,
      avatar,
    } = req.body;

    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !password || !name) {
      return res.status(400).json({ error: 'Completa nombre, correo y contrasena' });
    }

    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    try {
      const hash = await bcrypt.hash(password, 12);
      const createdUser = await runRegistrationWrite(async () => {
        const result = await runAsync(
          `INSERT INTO users (email, password, role, rate, name, profession, about, tags, avatar, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [cleanEmail, hash, role || 'client', rate || 0, name || 'Usuario', profession || '', about || '', JSON.stringify(tags || []), avatar || ''],
        );

        const nextCreatedUser = await getAsync('SELECT * FROM users WHERE id = ?', [result.lastID]);
        if (nextCreatedUser) {
          return nextCreatedUser;
        }

        await runAsync('DELETE FROM users WHERE id = ?', [result.lastID]).catch(() => null);
        throw new Error('No se pudo cargar el usuario creado');
      });

      const { token, refreshToken } = buildTokens(createdUser);
      attachAuthCookies(res, token, refreshToken);
      res.status(201).json({ token, user: formatUser(createdUser) });
    } catch (error) {
      const mapped = mapRegistrationError(error);
      res.status(mapped.status).json({ error: mapped.error });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();

    try {
      const user = await getAsync('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      if (!user) {
        return res.status(401).json({ error: 'Credenciales invalidas' });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: 'Credenciales invalidas' });
      }

      const { token, refreshToken } = buildTokens(user);
      attachAuthCookies(res, token, refreshToken);
      res.json({ token, user: formatUser(user) });
    } catch (error) {
      res.status(500).json({ error: 'Error interno' });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const { email, password } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const nextPassword = String(password || '');

    if (!cleanEmail || !nextPassword) {
      return res.status(400).json({ error: 'Debes indicar correo y nueva contrasena' });
    }

    const passwordError = validateStrongPassword(nextPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    try {
      const existingUser = await getAsync('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      if (!existingUser) {
        return res.status(404).json({ error: 'No existe una cuenta con ese correo' });
      }

      const hash = await bcrypt.hash(nextPassword, 12);
      await withSqliteBusyRetry(() => runAsync('UPDATE users SET password = ? WHERE id = ?', [hash, existingUser.id]));
      res.json({ success: true, message: 'Contrasena actualizada' });
    } catch (error) {
      const mapped = mapRegistrationError(error);
      res.status(mapped.status === 503 ? 503 : 500).json({ error: mapped.status === 503 ? mapped.error : 'No se pudo actualizar la contrasena' });
    }
  });

  app.post('/api/auth/refresh', (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token requerido' });

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) return res.status(401).json({ error: 'Refresh token invalido' });

      db.get('SELECT * FROM users WHERE id = ?', [decoded.id], (dbErr, user) => {
        if (dbErr || !user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const nextToken = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
        const nextRefreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
        attachAuthCookies(res, nextToken, nextRefreshToken);
        res.json({ success: true, token: nextToken, user: formatUser(user) });
      });
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  });
};
