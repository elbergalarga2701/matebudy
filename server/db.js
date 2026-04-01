import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'matebudy.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error abriendo Base de Datos:', err.message);
    else console.log('Base de Datos SQLite conectada (matebudy.sqlite)');
});

function ensureColumn(table, name, definition) {
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

db.serialize(() => {
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

    db.run(`CREATE TABLE IF NOT EXISTS post_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(post_id) REFERENCES posts(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS post_likes (
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (post_id, user_id),
        FOREIGN KEY(post_id) REFERENCES posts(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

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

    db.run(`CREATE TABLE IF NOT EXISTS user_presence (
        user_id INTEGER PRIMARY KEY,
        is_online BOOLEAN DEFAULT 0,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS monitor_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monitor_user_id INTEGER NOT NULL,
        target_user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(monitor_user_id, target_user_id),
        FOREIGN KEY(monitor_user_id) REFERENCES users(id),
        FOREIGN KEY(target_user_id) REFERENCES users(id)
    )`);

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

    db.run(`CREATE TABLE IF NOT EXISTS sos_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        message TEXT,
        location TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

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

    db.run(`CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

export default db;
