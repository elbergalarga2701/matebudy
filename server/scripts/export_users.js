import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'matebudy.sqlite');

const db = new sqlite3.Database(dbPath);

db.all('SELECT * FROM users', [], (err, rows) => {
  if (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
  
  console.log('--- USERS JSON EXPORT ---');
  console.log(JSON.stringify(rows, null, 2));
  console.log('--- END ---');
  
  fs.writeFileSync(path.join(__dirname, '..', 'users_export.json'), JSON.stringify(rows, null, 2));
  console.log('Saved to users_export.json');
  
  db.close();
});