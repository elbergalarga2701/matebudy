import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const tempRoot = path.join(projectRoot, '.tmp-tests', `registration-burst-${Date.now()}`);
const dbPath = path.join(tempRoot, 'matebudy-burst.sqlite');
const port = Number(process.env.BURST_TEST_PORT || 4317);
const adminCode = 'matebudy-admin-uy-test';
const totalRegistrations = Number(process.env.BURST_TEST_TOTAL || 12);
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+qN5QAAAAASUVORK5CYII=';
const pngBuffer = Buffer.from(pngBase64, 'base64');

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createImageBlob() {
  return new Blob([pngBuffer], { type: 'image/png' });
}

async function waitForServer(baseUrl, maxAttempts = 80) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch (error) {
      // Seguimos esperando hasta que el backend responda.
    }

    await sleep(250);
  }

  throw new Error('El backend de prueba no respondio a tiempo');
}

async function killServer(serverProcess) {
  if (!serverProcess || serverProcess.killed) return;

  serverProcess.kill();
  await sleep(800);

  if (!serverProcess.killed && serverProcess.pid) {
    const killer = spawn('taskkill', ['/pid', String(serverProcess.pid), '/t', '/f'], { stdio: 'ignore' });
    await new Promise((resolve) => {
      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
    });
  }
}

async function main() {
  await fs.mkdir(tempRoot, { recursive: true });

  const serverLogs = [];
  const serverProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DB_PATH: dbPath,
      ADMIN_PANEL_CODE: adminCode,
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (chunk) => {
    serverLogs.push(chunk.toString());
  });

  serverProcess.stderr.on('data', (chunk) => {
    serverLogs.push(chunk.toString());
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForServer(baseUrl);

    const runId = Date.now();
    const registrations = Array.from({ length: totalRegistrations }, (_, index) => index);

    const responses = await Promise.all(
      registrations.map(async (index) => {
        const form = new FormData();
        const email = `burst-${runId}-${index}@test.local`;

        form.set('email', email);
        form.set('password', 'Matebudy!2026');
        form.set('role', index % 2 === 0 ? 'provider' : 'client');
        form.set('rate', '0');
        form.set('name', `Burst ${index}`);
        form.set('profession', 'Prueba');
        form.set('about', 'Alta concurrente de verificacion');
        form.set('tags', JSON.stringify(['prueba', 'cola']));
        form.set('documentType', 'ci');
        form.set('documentNumber', String(10000000 + index));
        form.append('selfie', createImageBlob(), `selfie-${index}.png`);
        form.append('document', createImageBlob(), `document-${index}.png`);

        const response = await fetch(`${baseUrl}/api/auth/register-with-identity`, {
          method: 'POST',
          body: form,
        });

        const raw = await response.text();
        let data = {};

        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch (error) {
            data = { raw };
          }
        }

        return {
          email,
          ok: response.ok,
          status: response.status,
          data,
        };
      }),
    );

    const failedResponses = responses.filter((entry) => !entry.ok);
    if (failedResponses.length) {
      throw new Error(`Fallaron ${failedResponses.length} registros concurrentes: ${JSON.stringify(failedResponses, null, 2)}`);
    }

    const queueResponse = await fetch(`${baseUrl}/api/admin/verification-queue`, {
      headers: {
        'x-admin-code': adminCode,
      },
    });

    if (!queueResponse.ok) {
      const raw = await queueResponse.text();
      throw new Error(`No se pudo leer la cola de revision: ${queueResponse.status} ${raw}`);
    }

    const queuePayload = await queueResponse.json();
    const queue = Array.isArray(queuePayload.queue) ? queuePayload.queue : [];
    const testEntries = queue.filter((entry) => String(entry.email || '').endsWith('@test.local'));
    const expectedEmails = responses.map((entry) => entry.email).sort();
    const queueEmails = testEntries.map((entry) => entry.email).sort();
    const queueIds = testEntries.map((entry) => entry.id);

    if (queueEmails.length !== totalRegistrations) {
      throw new Error(`La cola devolvio ${queueEmails.length} usuarios de prueba y se esperaban ${totalRegistrations}`);
    }

    if (queueEmails.join('|') !== expectedEmails.join('|')) {
      throw new Error('La cola de revision no contiene exactamente los usuarios registrados en la rafaga');
    }

    if (!queueIds.every((id, index) => index === 0 || id > queueIds[index - 1])) {
      throw new Error(`La cola de revision no quedo ordenada de forma estable por id: ${queueIds.join(', ')}`);
    }

    console.log(`Registro concurrente verificado: ${totalRegistrations}/${totalRegistrations} altas correctas y cola estable.`);
  } finally {
    await killServer(serverProcess);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
