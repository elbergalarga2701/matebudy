import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { authRoutes } from './routes/auth.js';
import { chatRoutes } from './routes/chat.js';
import { userRoutes } from './routes/users.js';
import { postRoutes } from './routes/posts.js';
import { locationRoutes } from './routes/locations.js';
import { paymentRoutes } from './routes/payments.js';
import { sosRoutes } from './routes/sos.js';
import { adminRoutes } from './routes/admin.js';

import db from './db.js';
import { legacyUploadsDir, projectRoot, uploadsDir } from './paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  envLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;

    const separatorIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const JSON_LIMIT = process.env.JSON_LIMIT || '10mb';
const DEFAULT_ADMIN_CODE = process.env.ADMIN_PANEL_CODE || '';
const packageJsonPath = path.join(projectRoot, 'package.json');
const appVersion = (() => {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version || '1.0.0';
  } catch (error) {
    return '1.0.0';
  }
})();
const configuredOrigins = [
  'http://localhost',
  'https://localhost',
  'http://localhost:5173',
  'https://localhost:5173',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://matebudy.onrender.com',
  'https://matebudy-1.onrender.com',
  ...parseOrigins(process.env.CORS_ALLOWED_ORIGINS),
];
const allowAllOrigins = configuredOrigins.includes('*');
const allowedOrigins = [...new Set(configuredOrigins.filter((origin) => origin && origin !== '*'))];

function isOriginAllowed(origin) {
  return allowAllOrigins || allowedOrigins.includes(origin);
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-code'],
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
});

// Middleware
app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_LIMIT }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadsDir));
if (legacyUploadsDir !== uploadsDir && fs.existsSync(legacyUploadsDir)) {
  app.use('/uploads', express.static(legacyUploadsDir));
}
app.use(express.static(path.join(__dirname, '../dist')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend running correctly' });
});

// Sync users endpoint - para importar usuarios desde base de datos local
app.post('/api/admin/sync-users', (req, res) => {
  const code = req.headers['x-admin-code'];
  if (code !== DEFAULT_ADMIN_CODE) {
    return res.status(403).json({ error: 'Código inválido' });
  }
  
  const { users } = req.body;
  if (!Array.isArray(users)) {
    return res.status(400).json({ error: 'users debe ser un array' });
  }
  
  const results = [];
  const db = import('./db.js').then(({ default: dbModule }) => {
    users.forEach((user) => {
      const stmt = dbModule.prepare(`
        INSERT OR REPLACE INTO users (id, email, password, role, rate, isVerified, verificationStatus, 
          onboardingCompleted, profileStatus, name, profession, about, tags, avatar, 
          profileAnswers, verificationData, verificationReview, manualStatus, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        user.id, user.email, user.password, user.role, user.rate || 0,
        user.isVerified ? 1 : 0, user.verificationStatus || 'pending',
        user.onboardingCompleted ? 1 : 0, user.profileStatus || 'pendiente',
        user.name || 'Usuario', user.profession || '', user.about || '',
        user.tags || '[]', user.avatar || '',
        user.profileAnswers || '{}', user.verificationData || null,
        user.verificationReview || null, user.manualStatus || 'en_línea',
        user.created_at || new Date().toISOString()
      );
      results.push({ email: user.email, status: 'imported' });
    });
    
    res.json({ success: true, imported: results.length, users: results });
  }).catch((err) => {
    res.status(500).json({ error: err.message });
  });
});

// Update JSON for auto-update
app.get('/update.json', (req, res) => {
  res.json({
    version: process.env.APP_VERSION || appVersion,
    url: 'https://matebudy.onrender.com/matebudy.apk',
    notes: 'Actualizacion disponible de MateBudy',
    priority: 'high',
  });
});

// Serve APK files
app.get('/matebudy.apk', (req, res) => {
  const apkPath = path.join(__dirname, 'matebudy.apk');
  if (fs.existsSync(apkPath)) {
    res.download(apkPath);
  } else {
    res.status(404).json({ error: 'APK no encontrado' });
  }
});

// Register routes
authRoutes(app);
chatRoutes(app, io);
userRoutes(app);
postRoutes(app);
locationRoutes(app);
paymentRoutes(app);
sosRoutes(app);
adminRoutes(app);

// Serve static files - Hardcode for Render environment
const isRender = process.env.RENDER === 'true' || process.env.RENDER_EXTERNAL_URL;
const distPath = isRender ? '/opt/render/project/src/dist' : path.join(__dirname, '../dist');

console.log('[Server] Running on Render:', isRender);
console.log('[Server] Using dist path:', distPath);

if (fs.existsSync(path.join(distPath, 'index.html'))) {
  console.log('[Server] Frontend found at:', distPath);
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('[Server] WARNING: No frontend found at:', distPath);
  app.get('*', (req, res) => {
    res.status(500).send('Frontend no encontrado');
  });
}

httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`CORS origins enabled: ${allowedOrigins.join(', ')}`);
});
