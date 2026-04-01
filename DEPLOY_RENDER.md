# 🚀 DEPLOY AUTOMÁTICO EN RENDER - CONFIGURADO

## ✅ ESTADO ACTUAL

### Servicios en Render:
```
✅ matebudy (Node.js)   → https://matebudy.onrender.com
✅ matebudy-1 (Static)  → https://matebudy-1.onrender.com
```

### URLs Configuradas:
```env
VITE_API_URL=https://matebudy.onrender.com
VITE_SOCKET_URL=https://matebudy.onrender.com
VITE_UPDATE_URL=https://matebudy.onrender.com/update.json
```

---

## 📋 FLUJO DE TRABAJO PARA PRODUCCIÓN

### Opción 1: Deploy Automático con GitHub (RECOMENDADO)

**Configuración inicial (solo una vez):**

1. **Sube tu código a GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <tu-repo-url>
   git push -u origin main
   ```

2. **En Render.com:**
   - Ve a tu servicio `matebudy` (Node.js)
   - Click en "Settings" → "Git"
   - Conecta tu repositorio de GitHub
   - Activa "Auto-Deploy"
   
   - Ve a tu servicio `matebudy-1` (Static)
   - Click en "Settings" → "Git"
   - Conecta el MISMO repositorio
   - Directorio de publicación: `dist`
   - Activa "Auto-Deploy"

**Cada vez que hagas cambios:**

```bash
# 1. Haces tus cambios en el código

# 2. Commit y push
git add .
git commit -m "Descripción del cambio"
git push

# 3. Render detecta automáticamente y deploya (2-5 min)

# 4. La APK detecta el cambio en 60 segundos

# 5. ¡Listo! Usuarios tienen la nueva versión
```

---

### Opción 2: Deploy Manual (Sin GitHub)

**Para el Backend (matebudy):**

1. Haces cambios en el código del servidor
2. Subes los cambios a GitHub
3. En Render, ve al servicio `matebudy`
4. Click en "Manual Deploy" → "Deploy latest commit"

**Para el Frontend (matebudy-1):**

1. Ejecutas: `npm run build`
2. En Render, ve al servicio `matebudy-1`
3. Click en "Manual Deploy" → "Upload files"
4. Sube el contenido de la carpeta `dist/`

---

## 🔍 VERIFICACIÓN DEL DEPLOY

### 1. Verificar Backend:
```bash
curl https://matebudy.onrender.com/api/health
```

**Respuesta esperada:**
```json
{
  "status": "OK",
  "message": "Backend running correctly"
}
```

### 2. Verificar Update JSON:
```bash
curl https://matebudy.onrender.com/update.json
```

**Respuesta esperada:**
```json
{
  "version": "1.0.0",
  "buildId": "<timestamp-o-commit>",
  "url": "https://matebudy.onrender.com/Matebudy.apk",
  "notes": "Actualizacion disponible",
  "priority": "high"
}
```

### 3. Verificar Frontend:
Abre en tu navegador:
```
https://matebudy-1.onrender.com
```

Debería cargar la app.

---

## 📱 AUTO-ACTUALIZACIÓN EN PRODUCCIÓN

### ¿Cómo funciona para tus usuarios?

```
1. Usuario tiene la APK instalada
   ↓
2. La APK consulta /update.json cada 60 segundos
   ↓
3. Tú haces cambios y push a GitHub
   ↓
4. Render detecta y deploya automáticamente (2-5 min)
   ↓
5. El buildId cambia en /update.json
   ↓
6. La APK detecta el cambio (en 60 seg)
   ↓
7. APK muestra: "Aplicando la ultima version..."
   ↓
8. APK se recarga SOLA con el nuevo código
   ↓
9. ¡Usuario tiene la nueva versión sin hacer nada!
```

### Tiempos:
- **Deploy en Render:** 2-5 minutos
- **Detección en APK:** 60 segundos
- **Descarga y recarga:** 5-10 segundos
- **Total:** ~6-7 minutos automático

---

## ⚠️ IMPORTANTE: BUILD ID

Para que la auto-actualización funcione, el `buildId` debe cambiar en cada deploy.

**En Render, configura estas variables de entorno en `matebudy` (backend):**

```
APP_BUILD_ID = ${RENDER_GIT_COMMIT}
```

Esto hace que cada commit tenga un buildId único.

**Pasos en Render:**
1. Ve a `matebudy` servicio
2. Click en "Environment"
3. "Add Environment Variable"
4. Key: `APP_BUILD_ID`
5. Value: `${RENDER_GIT_COMMIT}`
6. Click "Save Changes"
7. Redeploya el servicio

---

## 🎯 RESUMEN DEL FLUJO COMPLETO

### Desarrollo Local:
```bash
# Cambios → npm run build → Probar en tu teléfono (WiFi local)
```

### Producción (Render):
```bash
# Cambios → git push → Render deploya automático → APK actualiza en 60 seg
```

---

## 📊 ESTADO DE TUS SERVICIOS

| Servicio | Tipo | URL | Estado |
|----------|------|-----|--------|
| matebudy | Node.js | https://matebudy.onrender.com | ✅ Deployed |
| matebudy-1 | Static | https://matebudy-1.onrender.com | ✅ Deployed |

---

## 🔧 PRÓXIMOS PASOS

### 1. Conectar GitHub (si no lo hiciste)
- Sube tu código a GitHub
- Conecta Render a tu repo
- Activa Auto-Deploy

### 2. Configurar APP_BUILD_ID
- Agrega la variable de entorno en Render
- Redeploya el backend

### 3. Probar auto-actualización
- Haz un cambio pequeño en el código
- Push a GitHub
- Espera 2-5 minutos (deploy en Render)
- Abre la APK en tu teléfono
- Ve a Perfil → "Buscar actualizacion"
- Debería detectar el cambio

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### La APK no detecta actualizaciones en producción

**Verifica:**
1. El backend está respondiendo: `curl https://matebudy.onrender.com/api/health`
2. El update.json tiene buildId: `curl https://matebudy.onrender.com/update.json`
3. Las URLs en `.env.production` son correctas
4. Hiciste `npm run build` después de cambiar las URLs

### El frontend no carga

**Verifica:**
1. El sitio estático está deployado en Render
2. La URL es correcta: https://matebudy-1.onrender.com
3. No hay errores de CORS en la consola del navegador

### Usuarios reportan que no se actualiza

**Posibles causas:**
1. El usuario no tiene conexión a internet
2. El servidor en Render está caído (revisa el dashboard)
3. El buildId no cambió (revisa las variables de entorno)

---

**Documento creado:** Abril 2026  
**Estado:** ✅ Configurado para producción en Render
