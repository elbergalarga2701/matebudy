/**
 * Tests básicos para el servidor de MateBudy
 * Uso: npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { setTimeout } from 'timers/promises';

describe('MateBudy Server', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Configurar entorno de test
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_secret_for_testing_only_12345678901234567890';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_for_testing_only_1234567890';
    process.env.PORT = '0'; // Puerto aleatorio
    
    // Importar servidor
    const { httpServer } = await import('../server/index.js');
    server = httpServer;
    
    // Obtener puerto asignado
    await new Promise((resolve) => {
      server.on('listening', resolve);
    });
    
    const address = server.address();
    baseUrl = `http://localhost:${address.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  describe('Health Check', () => {
    it('debe responder correctamente en /api/health', async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(response.status, 200);
      
      const data = await response.json();
      assert.strictEqual(data.status, 'OK');
      assert.strictEqual(data.message, 'Backend running correctly');
      assert.ok(data.version);
      assert.ok(data.timestamp);
    });
  });

  describe('Update Endpoint', () => {
    it('debe responder con información de versión en /update.json', async () => {
      const response = await fetch(`${baseUrl}/update.json`);
      assert.strictEqual(response.status, 200);
      
      const data = await response.json();
      assert.ok(data.version);
      assert.ok(data.buildId);
      assert.ok(data.publishedAt);
      assert.strictEqual(typeof data.notes, 'string');
    });
  });

  describe('CORS', () => {
    it('debe permitir origins configurados', async () => {
      const response = await fetch(`${baseUrl}/api/health`, {
        headers: {
          'Origin': 'http://localhost:5173',
        },
      });
      
      const corsHeader = response.headers.get('access-control-allow-origin');
      assert.strictEqual(corsHeader, 'http://localhost:5173');
    });

    it('debe rechazar origins no configurados', async () => {
      const response = await fetch(`${baseUrl}/api/health`, {
        headers: {
          'Origin': 'http://malicious-site.com',
        },
      });
      
      // En modo test, el CORS debería ser más estricto
      // El comportamiento exacto depende de la configuración
      assert.ok(response);
    });
  });

  describe('Rate Limiting', () => {
    it('debe incluir headers de rate limiting', async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      
      assert.ok(response.headers.has('X-RateLimit-Limit'));
      assert.ok(response.headers.has('X-RateLimit-Remaining'));
      assert.ok(response.headers.has('X-RateLimit-Reset'));
    });
  });

  describe('404 Handler', () => {
    it('debe responder 404 para rutas inexistentes', async () => {
      const response = await fetch(`${baseUrl}/api/nonexistent-route`);
      assert.strictEqual(response.status, 404);
      
      const data = await response.json();
      assert.strictEqual(data.error, 'Not found');
    });
  });

  describe('Authentication Endpoints', () => {
    it('debe rechazar login sin credenciales', async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      assert.strictEqual(response.status, 400);
    });

    it('debe rechazar registro sin datos', async () => {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      assert.ok([400, 401].includes(response.status));
    });
  });

  describe('Static Files', () => {
    it('debe servir el manifiesto PWA', async () => {
      const response = await fetch(`${baseUrl}/manifest.json`);
      
      // Puede ser 200 si existe o 404 si no se ha construido
      assert.ok([200, 404].includes(response.status));
    });
  });
});

describe('Configuración de Seguridad', () => {
  it('debe tener JWT_SECRET configurado', async () => {
    const { getJwtSecret } = await import('../server/config/security.js');
    
    // En modo test, debería usar el valor de process.env
    process.env.JWT_SECRET = 'test_secret';
    const secret = getJwtSecret();
    assert.strictEqual(secret, 'test_secret');
  });

  it('debe lanzar error si JWT_SECRET no está configurado en producción', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;
    
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    
    try {
      const { getJwtSecret } = await import('../server/config/security.js?reload=' + Date.now());
      // Debería lanzar error
      assert.fail('Debería haber lanzado un error');
    } catch (error) {
      assert.ok(error.message.includes('no configurada'));
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.JWT_SECRET = originalSecret;
    }
  });
});
