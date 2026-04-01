# Exponer MateBudy desde tu propia computadora

## Objetivo

Que la APK funcione desde cualquier parte de Uruguay mientras:

- el backend sigue siendo tuyo
- los datos quedan en tu disco
- el panel admin y los pagos los controlas desde tu computadora

## Requisitos minimos

1. Tu PC o mini servidor debe quedar encendido.
2. Tu router debe redirigir trafico externo al puerto interno del backend o del proxy.
3. Debes tener una URL publica estable.
4. Debes servir la app con HTTPS.

## Estructura recomendada

- `MateBudy frontend`: APK Android con `VITE_API_URL=https://tu-dominio.com`
- `MateBudy backend`: Node/Express en tu PC, puerto `3000`
- `Proxy HTTPS`: Caddy o Nginx escuchando `443`
- `Datos`: `server/matebudy.sqlite` y carpeta `uploads/`

## Paso 1. Preparar el servidor local

1. Copia [server/.env.example](/c:/Users/ianja/OneDrive/Escritorio/MATEBUDY/server/.env.example) a `server/.env`
2. Completa:
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `ADMIN_PANEL_CODE`
   - `CORS_ALLOWED_ORIGINS`
   - URLs de Mercado Pago cuando ya tengas dominio

## Paso 2. Dejar una URL publica estable

Necesitas una de estas dos rutas:

- un dominio propio apuntando a tu IP publica
- o DNS dinamico apuntando a tu IP publica

Sin eso, cuando cambie tu IP los celulares dejaran de encontrar el backend.

## Paso 3. HTTPS obligatorio

No abras la app al publico con solo `http`.

Usa un proxy HTTPS al frente del backend:

- entrada publica `443`
- reenvio interno a `http://127.0.0.1:3000`

## Paso 4. Router y firewall

Debes abrir y reenviar:

- puerto `443` hacia tu computadora o mini servidor

No expongas directamente el puerto `3000` a internet si puedes evitarlo.

## Paso 5. APK apuntando al backend publico

En el frontend, crea `.env.production`:

```env
VITE_API_URL=https://tu-dominio.com
```

Luego:

```powershell
npm run mobile:build
npm run android:open
```

## Paso 6. Backups

Haz copia automatica de:

- `server/matebudy.sqlite`
- `uploads/`
- `server/.env`

Idealmente a otro disco.

## Paso 7. Antes de abrir registro publico

- cambia el codigo admin por defecto
- cambia los secretos JWT
- usa HTTPS real
- prueba registro, login, KYC, chat, adjuntos y pagos desde otro celular y otra red

## Siguiente hito tecnico

Cuando ya tengas dominio o DNS dinamico, el siguiente paso es:

1. escribir `server/.env`
2. crear `.env.production`
3. regenerar la APK
4. probar acceso desde datos moviles
