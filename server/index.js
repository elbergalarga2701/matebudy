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
const uploadsDir = path.resolve(__dirname, process.env.UPLOADS_DIR || '../uploads');
const legacyUploadsDir = path.resolve(__dirname, 'uploads');
const allowedOrigins = [
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

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }

    callback(new Error(`Origen no permitido por CORS: ${origin}`));
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

// Register routes
authRoutes(app);
chatRoutes(app, io);
userRoutes(app);
postRoutes(app);
locationRoutes(app);
paymentRoutes(app);
sosRoutes(app);
adminRoutes(app);

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`CORS origins enabled: ${allowedOrigins.join(', ')}`);
});
