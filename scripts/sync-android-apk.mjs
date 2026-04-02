import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const sourceApkPath = path.join(projectRoot, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'Matebudy.apk');
const targetApkPath = path.join(projectRoot, 'server', 'matebudy.apk');

if (!fs.existsSync(sourceApkPath)) {
  console.error(`APK no encontrada en ${sourceApkPath}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(targetApkPath), { recursive: true });
fs.copyFileSync(sourceApkPath, targetApkPath);

console.log(`APK copiada a ${targetApkPath}`);
