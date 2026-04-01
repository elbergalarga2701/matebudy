import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const serverRoot = __dirname;
export const projectRoot = path.resolve(serverRoot, '..');
export const uploadsDir = path.resolve(serverRoot, process.env.UPLOADS_DIR || '../uploads');
export const legacyUploadsDir = path.resolve(serverRoot, 'uploads');
