import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabasePath } from './config/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuración de base de datos con soporte para SQLite y PostgreSQL
 */

// Verificar si se usa PostgreSQL o SQLite
const databaseUrl = process.env.DATABASE_URL;
const usePostgreSQL = databaseUrl && !databaseUrl.includes('sqlite');

let db;
let dbType;

if (usePostgreSQL) {
    // =============================================================================
    // MODO POSTGRESQL (Producción)
    // =============================================================================
    try {
        const { Pool } = await import('pg');

        const pool = new Pool({
            connectionString: databaseUrl,
            ssl: process.env.NODE_ENV === 'production' ? { 
                rejectUnauthorized: false,
                requestCert: true,
                rejectUnauthorized: false
            } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        db = {
            // Método para consultas con parámetros
            all: async (sql, params = []) => {
                const result = await pool.query(sql.replace(/\?/g, '$&'), params.map((p, i) => params[i]));
                return result.rows;
            },

            get: async (sql, params = []) => {
                const result = await pool.query(sql.replace(/LIMIT 1/i, 'LIMIT 1'), params);
                return result.rows[0] || null;
            },

            run: async (sql, params = []) => {
                const result = await pool.query(sql, params);
                return {
                    changes: result.rowCount,
                    lastID: result.rows?.[0]?.id,
                };
            },

            // Método para PRAGMA (solo SQLite, no hacer nada en PostgreSQL)
            configure: () => { },

            // Cerrar conexión
            close: () => {
                pool.end();
            },

            // Serializar (ejecutar en transacción)
            serialize: async (callback) => {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    await callback();
                    await client.query('COMMIT');
                } catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                } finally {
                    client.release();
                }
            },

            // Tipo de base de datos
            type: 'postgresql',
        };

        dbType = 'postgresql';
        console.log('✅ Base de datos PostgreSQL conectada');
    } catch (error) {
        console.error('❌ Error conectando a PostgreSQL:', error.message);
        console.log('⚠️  Cambiando a modo SQLite...');
        // Fallback a SQLite
        usePostgreSQL = false;
    }
}

if (!usePostgreSQL) {
    // =============================================================================
    // MODO SQLITE (Desarrollo)
    // =============================================================================
    const sqlite3 = await import('sqlite3');

    const dbPath = getDatabasePath() || path.join(__dirname, 'matebudy.sqlite');
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new sqlite3.default.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ Error abriendo Base de Datos:', err.message);
        } else {
            console.log('✅ Base de Datos SQLite conectada:', dbPath);
        }
    });

    db.configure('busyTimeout', 10000);
    dbType = 'sqlite';
}

// =============================================================================
// FUNCIONES DE UTILIDAD
// =============================================================================

/**
 * Verifica y agrega columnas faltantes (solo SQLite)
 */
export function ensureColumn(table, name, definition) {
    if (dbType === 'postgresql') {
        // En PostgreSQL las migraciones se manejan diferente
        return;
    }

    db.all(`PRAGMA table_info(${table})`, (err, columns) => {
        if (err) {
            console.error(`Error leyendo columnas de ${table}:`, err.message);
            return;
        }

        if (!columns.some((column) => column.name === name)) {
            db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`, (alterErr) => {
                if (alterErr) {
                    console.error(`Error agregando columna ${name} en ${table}:`, alterErr.message);
                }
            });
        }
    });
}

/**
 * Inicializa el schema de la base de datos
 */
export function initializeDatabase() {
    if (dbType === 'postgresql') {
        initializePostgreSQL();
    } else {
        initializeSQLite();
    }
}

/**
 * Inicializa schema SQLite
 */
function initializeSQLite() {
    db.serialize(() => {
        db.run('PRAGMA journal_mode = WAL');
        db.run('PRAGMA synchronous = NORMAL');
        db.run('PRAGMA foreign_keys = ON');

        // Tabla users
        db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      rate INTEGER DEFAULT 0,
      isVerified BOOLEAN DEFAULT 0,
      verificationStatus TEXT DEFAULT 'pending',
      onboardingCompleted BOOLEAN DEFAULT 0,
      profileStatus TEXT DEFAULT 'pendiente',
      name TEXT DEFAULT 'Amigo de Mate',
      profession TEXT DEFAULT 'Sin Definir',
      about TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      avatar TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=Generico',
      profileAnswers TEXT DEFAULT '{}',
      verificationData TEXT,
      verificationReview TEXT,
      manualStatus TEXT DEFAULT 'en_linea',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

        ensureColumn('users', 'verificationStatus', "TEXT DEFAULT 'pending'");
        ensureColumn('users', 'onboardingCompleted', 'BOOLEAN DEFAULT 0');
        ensureColumn('users', 'profileStatus', "TEXT DEFAULT 'pendiente'");
        ensureColumn('users', 'profileAnswers', "TEXT DEFAULT '{}'");
        ensureColumn('users', 'verificationData', 'TEXT');
        ensureColumn('users', 'verificationReview', 'TEXT');
        ensureColumn('users', 'manualStatus', "TEXT DEFAULT 'en_linea'");

        // Tabla posts
        db.run(`CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      content TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      type TEXT DEFAULT 'normal',
      image_url TEXT,
      mood TEXT DEFAULT 'Comunidad',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
        ensureColumn('posts', 'image_url', 'TEXT');
        ensureColumn('posts', 'mood', "TEXT DEFAULT 'Comunidad'");

        // Tabla post_comments
        db.run(`CREATE TABLE IF NOT EXISTS post_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES posts(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

        // Tabla post_likes
        db.run(`CREATE TABLE IF NOT EXISTS post_likes (
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (post_id, user_id),
      FOREIGN KEY(post_id) REFERENCES posts(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

        // Tabla messages
        db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      sender_id INTEGER,
      text TEXT NOT NULL,
      kind TEXT DEFAULT 'text',
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sender_id) REFERENCES users(id)
    )`);
        ensureColumn('messages', 'kind', "TEXT DEFAULT 'text'");
        ensureColumn('messages', 'meta', 'TEXT');

        // Tabla locations
        db.run(`CREATE TABLE IF NOT EXISTS locations (
      user_id INTEGER PRIMARY KEY,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      battery_level REAL,
      accuracy REAL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
        ensureColumn('locations', 'battery_level', 'REAL');
        ensureColumn('locations', 'accuracy', 'REAL');

        // Tabla user_presence
        db.run(`CREATE TABLE IF NOT EXISTS user_presence (
      user_id INTEGER PRIMARY KEY,
      is_online BOOLEAN DEFAULT 0,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

        // Tabla monitor_links
        db.run(`CREATE TABLE IF NOT EXISTS monitor_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_user_id INTEGER NOT NULL,
      target_user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(monitor_user_id, target_user_id),
      FOREIGN KEY(monitor_user_id) REFERENCES users(id),
      FOREIGN KEY(target_user_id) REFERENCES users(id)
    )`);

        // Tabla monitor_link_requests
        db.run(`CREATE TABLE IF NOT EXISTS monitor_link_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_user_id INTEGER NOT NULL,
      target_user_id INTEGER NOT NULL,
      note TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      responded_at DATETIME,
      FOREIGN KEY(monitor_user_id) REFERENCES users(id),
      FOREIGN KEY(target_user_id) REFERENCES users(id)
    )`);
        ensureColumn('monitor_link_requests', 'note', 'TEXT');
        ensureColumn('monitor_link_requests', 'status', "TEXT DEFAULT 'pending'");
        ensureColumn('monitor_link_requests', 'responded_at', 'DATETIME');

        // Tabla transactions
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      provider_id INTEGER,
      amount REAL,
      hours INTEGER,
      status TEXT DEFAULT 'pending',
      fee REAL DEFAULT 0,
      provider_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(client_id) REFERENCES users(id),
      FOREIGN KEY(provider_id) REFERENCES users(id)
    )`);

        ensureColumn('transactions', 'currency', "TEXT DEFAULT 'UYU'");
        ensureColumn('transactions', 'installments', 'INTEGER DEFAULT 1');
        ensureColumn('transactions', 'external_reference', 'TEXT');
        ensureColumn('transactions', 'provider_name', 'TEXT');
        ensureColumn('transactions', 'service_label', 'TEXT');
        ensureColumn('transactions', 'hourly_rate', 'REAL DEFAULT 0');
        ensureColumn('transactions', 'mp_preference_id', 'TEXT');
        ensureColumn('transactions', 'mp_payment_id', 'TEXT');
        ensureColumn('transactions', 'mp_status', 'TEXT');
        ensureColumn('transactions', 'notification_payload', 'TEXT');
        ensureColumn('transactions', 'released_at', 'DATETIME');
        ensureColumn('transactions', 'refunded_at', 'DATETIME');
        ensureColumn('transactions', 'disputed_at', 'DATETIME');

        // Tabla sos_alerts
        db.run(`CREATE TABLE IF NOT EXISTS sos_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      message TEXT,
      location TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

        // Tabla reviews
        db.run(`CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER,
      reviewer_id INTEGER,
      reviewed_id INTEGER,
      rating INTEGER,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(transaction_id) REFERENCES transactions(id),
      FOREIGN KEY(reviewer_id) REFERENCES users(id),
      FOREIGN KEY(reviewed_id) REFERENCES users(id)
    )`);

        // Tabla app_settings
        db.run(`CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

        // Índices
        db.run('CREATE INDEX IF NOT EXISTS idx_users_verification_queue ON users (verificationStatus, created_at, id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at, id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON post_comments (post_id, created_at, id)');
    });
}

/**
 * Inicializa schema PostgreSQL
 */
async function initializePostgreSQL() {
    // Las migraciones de PostgreSQL se manejan con un sistema de migraciones
    // Por ahora usamos el mismo schema adaptado
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      rate INTEGER DEFAULT 0,
      isVerified BOOLEAN DEFAULT FALSE,
      verificationStatus VARCHAR(50) DEFAULT 'pending',
      onboardingCompleted BOOLEAN DEFAULT FALSE,
      profileStatus VARCHAR(50) DEFAULT 'pendiente',
      name VARCHAR(255) DEFAULT 'Amigo de Mate',
      profession VARCHAR(255) DEFAULT 'Sin Definir',
      about TEXT DEFAULT '',
      tags JSONB DEFAULT '[]'::jsonb,
      avatar TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=Generico',
      profileAnswers JSONB DEFAULT '{}'::jsonb,
      verificationData JSONB,
      verificationReview JSONB,
      manualStatus VARCHAR(50) DEFAULT 'en_linea',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

        `CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      type VARCHAR(50) DEFAULT 'normal',
      image_url TEXT,
      mood VARCHAR(50) DEFAULT 'Comunidad',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

        `CREATE TABLE IF NOT EXISTS post_comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER REFERENCES posts(id),
      user_id INTEGER REFERENCES users(id),
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

        `CREATE TABLE IF NOT EXISTS post_likes (
      post_id INTEGER REFERENCES posts(id),
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (post_id, user_id)
    )`,

        `CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      room_id VARCHAR(255) NOT NULL,
      sender_id INTEGER REFERENCES users(id),
      text TEXT NOT NULL,
      kind VARCHAR(50) DEFAULT 'text',
      meta JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

        `CREATE TABLE IF NOT EXISTS locations (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      battery_level DOUBLE PRECISION,
      accuracy DOUBLE PRECISION,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

        `CREATE TABLE IF NOT EXISTS user_presence (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      is_online BOOLEAN DEFAULT FALSE,
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

        `CREATE TABLE IF NOT EXISTS monitor_links (
      id SERIAL PRIMARY KEY,
      monitor_user_id INTEGER REFERENCES users(id),
      target_user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(monitor_user_id, target_user_id)
    )`,

        `CREATE TABLE IF NOT EXISTS monitor_link_requests (
      id SERIAL PRIMARY KEY,
      monitor_user_id INTEGER REFERENCES users(id),
      target_user_id INTEGER REFERENCES users(id),
      note TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      responded_at TIMESTAMP
    )`,

        `CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES users(id),
      provider_id INTEGER REFERENCES users(id),
      amount DECIMAL(10,2),
      hours INTEGER,
      status VARCHAR(50) DEFAULT 'pending',
      fee DECIMAL(10,2) DEFAULT 0,
      provider_amount DECIMAL(10,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'UYU',
      installments INTEGER DEFAULT 1,
      external_reference VARCHAR(255),
      provider_name VARCHAR(255),
      service_label VARCHAR(255),
      hourly_rate DECIMAL(10,2) DEFAULT 0,
      mp_preference_id VARCHAR(255),
      mp_payment_id VARCHAR(255),
      mp_status VARCHAR(100),
      notification_payload JSONB,
      released_at TIMESTAMP,
      refunded_at TIMESTAMP,
      disputed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

        `CREATE TABLE IF NOT EXISTS sos_alerts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      message TEXT,
      location TEXT,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

        `CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      transaction_id INTEGER REFERENCES transactions(id),
      reviewer_id INTEGER REFERENCES users(id),
      reviewed_id INTEGER REFERENCES users(id),
      rating INTEGER,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

        `CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    ];

    for (const table of tables) {
        try {
            await db.run(table);
        } catch (error) {
            console.error('Error creando tabla:', error.message);
        }
    }

    // Índices
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_users_verification_queue ON users (verificationStatus, created_at, id)',
        'CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at, id)',
        'CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON post_comments (post_id, created_at, id)',
    ];

    for (const index of indexes) {
        try {
            await db.run(index);
        } catch (error) {
            console.error('Error creando índice:', error.message);
        }
    }
}

// Inicializar la base de datos
initializeDatabase();

export default db;
export { dbType };
