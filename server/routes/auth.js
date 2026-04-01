import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'matebudy_super_secret_key_mvp_only';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_mvp';
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL || '7d';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TTL || '30d';
const ACCESS_TOKEN_MAX_AGE_MS = Number(process.env.JWT_ACCESS_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000);
const REFRESH_TOKEN_MAX_AGE_MS = Number(process.env.JWT_REFRESH_MAX_AGE_MS || 30 * 24 * 60 * 60 * 1000);
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
  },
});

function authCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge,
  };
}

function fileUrl(file) {
  if (!file) return null;
  return `/uploads/${path.basename(file.path)}`;
}

function safeUnlink(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, () => {});
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
    tags: JSON.parse(row.tags || '[]'),
    avatar: row.avatar || '',
    manualStatus: row.manualStatus || 'en_linea',
    isOnline: Boolean(row.is_online),
    lastSeen: row.last_seen || null,
    profileAnswers: JSON.parse(row.profileAnswers || '{}'),
    verificationData: row.verificationData ? JSON.parse(row.verificationData) : null,
    verificationReview: row.verificationReview ? JSON.parse(row.verificationReview) : null,
    created_at: row.created_at,
  };
}

export const verifyToken = (req, res, next) => {
  let token = null;

  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // Fallback to cookie
  if (!token && req.cookies) {
    token = req.cookies.token;
  }

  if (!token) return res.status(403).json({ error: 'Token requerido' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido' });
    req.user = decoded;
    next();
  });
};

export const authRoutes = (app) => {
  // Debug middleware para ver qué llega al endpoint
  app.use('/api/auth/register-with-identity', (req, res, next) => {
    console.log('[DEBUG] Request received:', {
      method: req.method,
      contentType: req.headers['content-type'],
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : null,
    });
    next();
  });

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

    const selfieFile = req.files?.selfie?.[0];
    const documentFile = req.files?.document?.[0];

    if (!email || !password || !name) {
      safeUnlink(selfieFile?.path);
      safeUnlink(documentFile?.path);
      return res.status(400).json({ error: 'Completa nombre, correo y contrasena' });
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

    let createdUserId = null;

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

      const insertResult = await runAsync(
        `INSERT INTO users (
          email, password, role, rate, name, profession, about, tags, avatar,
          isVerified, verificationStatus, profileStatus, verificationData, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          email,
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

      createdUserId = insertResult.lastID;

      const token = jwt.sign({ id: createdUserId, role: role || 'client', email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
      const refreshToken = jwt.sign({ id: createdUserId }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
      const createdUser = await getAsync('SELECT * FROM users WHERE id = ?', [createdUserId]);

      if (!createdUser) {
        throw new Error('No se pudo cargar el usuario creado');
      }

      res.cookie('token', token, authCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
      res.cookie('refreshToken', refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE_MS));
      res.status(201).json({
        token,
        user: formatUser(createdUser),
      });
    } catch (e) {
      if (createdUserId) {
        await runAsync('DELETE FROM users WHERE id = ?', [createdUserId]).catch(() => {});
      }
      safeUnlink(selfieFile?.path);
      safeUnlink(documentFile?.path);

      if (/SQLITE_CONSTRAINT/i.test(String(e?.message || ''))) {
        return res.status(400).json({ error: 'Email ya registrado' });
      }

      res.status(500).json({ error: 'Error interno' });
    }
  });

  // Register
  app.post('/api/auth/register', async (req, res) => {
    const { email, password, role, rate, name, profession, about, tags, avatar } = req.body;
    try {
      const hash = await bcrypt.hash(password, 12);
      db.run(
        `INSERT INTO users (email, password, role, rate, name, profession, about, tags, avatar, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [email, hash, role || 'client', rate || 0, name || 'Usuario', profession || '', about || '', JSON.stringify(tags || []), avatar || ''],
        function (err) {
          if (err) return res.status(400).json({ error: 'Email ya registrado' });
          const token = jwt.sign({ id: this.lastID, role: role || 'client', email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
          const refreshToken = jwt.sign({ id: this.lastID }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

          res.cookie('token', token, authCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
          res.cookie('refreshToken', refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE_MS));

          db.get(
            'SELECT * FROM users WHERE id = ?',
            [this.lastID],
            (getErr, createdUser) => {
              if (getErr || !createdUser) return res.status(500).json({ error: 'No se pudo cargar el usuario creado' });
              res.status(201).json({ token, user: formatUser(createdUser) });
            }
          );
        }
      );
    } catch (e) {
      res.status(500).json({ error: 'Error interno' });
    }
  });

  // Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    console.log('[LOGIN] Attempt:', cleanEmail);
    db.get('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail], async (err, user) => {
      if (err) {
        console.log('[LOGIN] DB Error:', err.message);
        return res.status(500).json({ error: 'Error interno' });
      }
      if (!user) {
        console.log('[LOGIN] User not found:', email);
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      console.log('[LOGIN] User found:', user.email, 'hasPassword:', !!user.password);
      const valid = await bcrypt.compare(password, user.password);
      console.log('[LOGIN] bcrypt result:', valid);
      if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

      const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
      const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

      res.cookie('token', token, authCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
      res.cookie('refreshToken', refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE_MS));

      res.json({ token, user: formatUser(user) });
    });
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const { email, password } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const nextPassword = String(password || '');

    if (!cleanEmail || !nextPassword) {
      return res.status(400).json({ error: 'Debes indicar correo y nueva contrasena' });
    }

    if (nextPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contrasena debe tener al menos 6 caracteres' });
    }

    try {
      const existingUser = await getAsync('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      if (!existingUser) {
        return res.status(404).json({ error: 'No existe una cuenta con ese correo' });
      }

      const hash = await bcrypt.hash(nextPassword, 12);
      await runAsync('UPDATE users SET password = ? WHERE id = ?', [hash, existingUser.id]);
      res.json({ success: true, message: 'Contrasena actualizada' });
    } catch (error) {
      res.status(500).json({ error: 'No se pudo actualizar la contrasena' });
    }
  });

  // Refresh Token
  app.post('/api/auth/refresh', (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token requerido' });

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) return res.status(401).json({ error: 'Refresh token inválido' });

      db.get('SELECT * FROM users WHERE id = ?', [decoded.id], (dbErr, user) => {
        if (dbErr || !user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const newToken = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
        const newRefreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
        res.cookie('token', newToken, authCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
        res.cookie('refreshToken', newRefreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE_MS));
        res.json({ success: true, token: newToken, user: formatUser(user) });
      });
    });
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  });

};
