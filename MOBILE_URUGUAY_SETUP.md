# MateBudy Android + backend propio en Uruguay

## Objetivo

Tener una APK descargable que funcione en celulares Android de cualquier punto de Uruguay, mientras el control administrativo, pagos y autorizaciones sigue en tu computadora o en un equipo tuyo.

## Como queda la arquitectura

- La app Android usa el frontend actual empaquetado con Capacitor.
- El backend sigue siendo tu `server/` con Node y Express.
- Los datos pueden seguir en tu disco con SQLite y carpetas locales como `uploads/`.
- Los celulares ya no usan `localhost`; se conectan a una URL publica de tu backend.
- Tu panel administrativo sigue funcionando desde tu computadora.

## Lo que necesitas para que funcione en todo Uruguay

1. Un backend accesible desde internet.
2. Una URL publica estable.
3. HTTPS.
4. Tu computadora encendida cuando la app se use, o un equipo dedicado que haga de servidor.

Si la app se va a usar fuera de tu Wi-Fi, `localhost` no sirve. La APK necesita una URL como:

- `https://api.tudominio.com`
- `https://matebudy.uy`
- o una IP publica con proxy HTTPS

## Variable de entorno del frontend movil

Crea un archivo `.env.production` o `.env.local` con:

```env
VITE_API_URL=https://tu-dominio-o-ip-publica
```

En desarrollo web puedes seguir usando el proxy de Vite y dejar esa variable vacia.

## Flujo para sacar la APK

1. Configura `VITE_API_URL` con tu backend publico.
2. Genera y sincroniza Android:

```powershell
npm run mobile:build
```

3. Abre Android Studio:

```powershell
npm run android:open
```

4. Desde Android Studio genera:
   - `Debug APK` para pruebas
   - `Release APK` cuando ya estes conforme

## Backend en tu propia computadora

Tu backend puede quedar en tu PC, pero debes preparar estas capas:

- Node/Express corriendo siempre
- SQLite y `uploads/` en disco local
- reenvio de puertos en tu router
- DNS dinamico o dominio
- proxy reverso con HTTPS

## Recomendacion minima de despliegue propio

### Opcion inicial

- Windows + Node
- tu backend escuchando en puerto `3000`
- Caddy o Nginx al frente para exponer `443`
- dominio apuntando a tu IP publica

### Opcion mas estable

- una mini PC o notebook dedicada en tu casa/oficina
- Windows o Linux
- UPS si puedes conseguirla mas adelante
- disco con backups automaticos

## Seguridad minima antes de abrirla al publico

- Cambiar el codigo admin hardcodeado por una variable de entorno.
- Usar HTTPS obligatorio.
- No guardar documentos sensibles en carpetas publicas sin control.
- Hacer backup diario de `server/data.sqlite` o el archivo real que uses.
- Restringir tamanos de archivos y tipos MIME.
- Agregar logs de auditoria para aprobaciones y pagos.

## Mercado Pago

Cuando la app ya apunte a una URL publica:

- `Webhook URL`: usa tu endpoint publico real
- `Success/Pending/Failure`: usa tu dominio real o deep links planeados
- En `Produccion`, usa credenciales reales y email real del pagador
- En `Prueba`, usa comprador y tarjetas de prueba

## Lo que ya quedo preparado en el repo

- Base Android agregada con Capacitor
- scripts para build y sync Android
- `VITE_API_URL` para que la APK se conecte a tu backend real
- llamadas frontend listas para usar URL publica

## Siguiente orden recomendado

1. Definir la URL publica del backend.
2. Dejar encendido el backend local y probar desde otro dispositivo en otra red.
3. Generar la primera APK.
4. Ajustar permisos nativos de camara, microfono, archivos y ubicacion si hace falta.
5. Endurecer seguridad antes de abrir registro publico.
