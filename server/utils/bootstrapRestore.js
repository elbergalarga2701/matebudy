import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { createBackup } from './backup.js';
import { getDatabasePath } from '../paths.js';

const APPROVED_SNAPSHOT_HASHES = new Set([
  '6263C2558A0730248E4E876C5C9C1B470F54BEBEEB77C7392015D6598C33597A',
]);

const INSERT_ORDER = [
  'users',
  'posts',
  'post_comments',
  'post_likes',
  'messages',
  'locations',
  'user_presence',
  'monitor_links',
  'monitor_link_requests',
  'transactions',
  'sos_alerts',
  'reviews',
  'app_settings',
];

const DELETE_ORDER = [...INSERT_ORDER].reverse();
const BOOTSTRAP_EMAIL_PATTERN = /^codex-test\+/i;

function quoteIdentifier(value) {
  return `"${String(value || '').replace(/"/g, '""')}"`;
}

function openSqliteDatabase(filePath, mode) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filePath, mode, (error) => {
      if (error) reject(error);
      else resolve(db);
    });
  });
}

function closeSqliteDatabase(db) {
  return new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function allSqlite(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows || []);
    });
  });
}

function getSqlite(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row || null);
    });
  });
}

function runSqlite(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

async function computeFileSha256(filePath) {
  const hash = crypto.createHash('sha256');

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  return hash.digest('hex').toUpperCase();
}

async function listTables(db) {
  const rows = await allSqlite(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  return new Set(rows.map((row) => row.name).filter(Boolean));
}

async function listColumns(db, tableName) {
  const rows = await allSqlite(db, `PRAGMA table_info(${quoteIdentifier(tableName)})`);
  return rows.map((row) => row.name).filter(Boolean);
}

async function readRows(db, tableName, columnNames) {
  if (!columnNames.length) return [];

  const sql = `SELECT ${columnNames.map(quoteIdentifier).join(', ')} FROM ${quoteIdentifier(tableName)}`;
  return allSqlite(db, sql);
}

async function ensureBootstrapWindow(targetDb) {
  const rows = await allSqlite(
    targetDb,
    'SELECT id, email FROM users ORDER BY id ASC',
  );

  const hasRealUsers = rows.some((row) => !BOOTSTRAP_EMAIL_PATTERN.test(String(row.email || '').trim()));
  if (hasRealUsers || rows.length > 1) {
    throw new Error('La restauracion bootstrap ya no esta permitida en esta base');
  }
}

async function resetSqliteSequenceIfNeeded(targetDb, tableName, targetColumns) {
  if (!targetColumns.includes('id')) return;

  try {
    const row = await getSqlite(
      targetDb,
      `SELECT MAX(id) AS maxId FROM ${quoteIdentifier(tableName)}`,
    );
    const maxId = Number(row?.maxId || 0);

    await runSqlite(targetDb, 'DELETE FROM sqlite_sequence WHERE name = ?', [tableName]);
    if (maxId > 0) {
      await runSqlite(
        targetDb,
        'INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)',
        [tableName, maxId],
      );
    }
  } catch {
    // sqlite_sequence no existe en todas las bases; ignorar.
  }
}

export async function restoreSqliteSnapshot({
  snapshotPath,
  targetDbPath = getDatabasePath(),
  enforceBootstrapGuard = true,
}) {
  if (!snapshotPath || !fs.existsSync(snapshotPath)) {
    throw new Error('Snapshot SQLite no encontrado');
  }

  if (!targetDbPath) {
    throw new Error('La base activa no usa SQLite; no se puede restaurar con este flujo');
  }

  const snapshotHash = await computeFileSha256(snapshotPath);
  if (!APPROVED_SNAPSHOT_HASHES.has(snapshotHash)) {
    throw new Error('El snapshot no coincide con el backup aprobado para la migracion');
  }

  const sourceDb = await openSqliteDatabase(snapshotPath, sqlite3.OPEN_READONLY);
  const targetDb = await openSqliteDatabase(targetDbPath, sqlite3.OPEN_READWRITE);

  let createdBackupPath = null;

  try {
    if (enforceBootstrapGuard) {
      await ensureBootstrapWindow(targetDb);
    }

    const sourceTables = await listTables(sourceDb);
    const targetTables = await listTables(targetDb);
    const importedCounts = {};

    createdBackupPath = await createBackup().catch(() => null);

    await runSqlite(targetDb, 'PRAGMA foreign_keys = OFF');
    await runSqlite(targetDb, 'BEGIN IMMEDIATE');

    try {
      for (const tableName of DELETE_ORDER) {
        if (!targetTables.has(tableName)) continue;
        await runSqlite(targetDb, `DELETE FROM ${quoteIdentifier(tableName)}`);
      }

      for (const tableName of INSERT_ORDER) {
        if (!sourceTables.has(tableName) || !targetTables.has(tableName)) {
          importedCounts[tableName] = 0;
          continue;
        }

        const sourceColumns = await listColumns(sourceDb, tableName);
        const targetColumns = await listColumns(targetDb, tableName);
        const sharedColumns = sourceColumns.filter((columnName) => targetColumns.includes(columnName));

        if (!sharedColumns.length) {
          importedCounts[tableName] = 0;
          continue;
        }

        const rows = await readRows(sourceDb, tableName, sharedColumns);
        importedCounts[tableName] = rows.length;

        if (!rows.length) continue;

        const insertSql = `INSERT INTO ${quoteIdentifier(tableName)} (${sharedColumns.map(quoteIdentifier).join(', ')}) VALUES (${sharedColumns.map(() => '?').join(', ')})`;

        for (const row of rows) {
          const values = sharedColumns.map((columnName) => row[columnName] ?? null);
          await runSqlite(targetDb, insertSql, values);
        }

        await resetSqliteSequenceIfNeeded(targetDb, tableName, targetColumns);
      }

      await runSqlite(targetDb, 'COMMIT');
    } catch (error) {
      await runSqlite(targetDb, 'ROLLBACK').catch(() => null);
      throw error;
    } finally {
      await runSqlite(targetDb, 'PRAGMA foreign_keys = ON').catch(() => null);
    }

    const userCountRow = await getSqlite(targetDb, 'SELECT COUNT(*) AS count FROM users');

    return {
      snapshotHash,
      targetDbPath,
      createdBackupPath,
      importedCounts,
      finalUserCount: Number(userCountRow?.count || 0),
    };
  } finally {
    await closeSqliteDatabase(sourceDb).catch(() => null);
    await closeSqliteDatabase(targetDb).catch(() => null);
  }
}

export function approvedSnapshotHashes() {
  return [...APPROVED_SNAPSHOT_HASHES];
}
