# ⚙️ CONFIGURAR RENDER - PASO A PASO

## ✅ render.yaml YA ESTÁ CONFIGURADO

El archivo tiene TODA la configuración necesaria. Ahora necesitas aplicarla en Render.

---

## 📋 PASOS EN EL DASHBOARD DE RENDER

### Paso 1: Ir al Dashboard
```
https://dashboard.render.com
```

### Paso 2: Buscar tu Proyecto
- Busca el proyecto llamado `matebudy` o `My project`
- Deberías ver 2 servicios:
  - `matebudy` (Node.js) ← Backend
  - `matebudy-1` (Static) ← Frontend

### Paso 3: Configurar el Backend (matebudy)

1. **Click en el servicio** `matebudy` (Node.js)
2. **Ve a "Settings"**
3. **Scroll a "Environment Variables"**
4. **Agrega/Verifica estas variables:**

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | (genera uno nuevo) |
| `JWT_REFRESH_SECRET` | (genera uno nuevo) |
| `ADMIN_PANEL_CODE` | `matebudy-admin-uy-2026` |
| `CORS_ALLOWED_ORIGINS` | `https://matebudy.onrender.com,https://matebudy-1.onrender.com` |
| `DATABASE_URL` | `sqlite://./matebudy.sqlite` |
| `BACKUP_ENABLED` | `true` |
| `LOG_LEVEL` | `info` |

5. **Click "Save Changes"**
6. **Scroll a "Build & Deploy"**
7. **En "Build Command"** pon: `npm install --include=dev`
8. **En "Start Command"** pon: `npm start`
9. **Click "Manual Deploy"** → "Deploy latest commit"

### Paso 4: Configurar el Frontend (matebudy-1)

1. **Regresa al proyecto** (atrás)
2. **Click en el servicio** `matebudy-1` (Static)
3. **Ve a "Settings"**
4. **Scroll a "Build & Deploy"**
5. **En "Build Command"** pon: `npm install && npm run build`
6. **En "Publish Directory"** pon: `./dist`
7. **Scroll a "Environment Variables"**
8. **Agrega estas variables:**

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://matebudy.onrender.com` |
| `VITE_SOCKET_URL` | `https://matebudy.onrender.com` |
| `VITE_UPDATE_URL` | `https://matebudy.onrender.com/update.json` |
| `NODE_ENV` | `production` |

9. **Click "Save Changes"**
10. **Click "Manual Deploy"** → "Deploy latest commit"

---

## ⏱️ TIEMPOS DE ESPERA

| Servicio | Tiempo |
|----------|--------|
| Backend | 2-5 min |
| Frontend | 1-3 min |
| **TOTAL** | **~5-8 min** |

---

## ✅ VERIFICAR QUE FUNCIONÓ

### Después de 5-8 minutos:

1. **Backend:**
   ```
   https://matebudy.onrender.com/api/health
   ```
   Debería decir: `{"status":"OK","message":"Backend running correctly"}`

2. **Frontend:**
   ```
   https://matebudy-1.onrender.com
   ```
   Debería cargar la app con el NUEVO DISEÑO (fondo oscuro, botones púrpuras)

3. **Limpia caché** si es necesario:
   - Ctrl + Shift + Supr
   - Marca "Imágenes y archivos en caché"
   - Click "Borrar datos"
   - Recarga: Ctrl + F5

---

## 🎨 QUÉ DEBERÍAS VER EN EL FRONTEND

- ✨ **Fondo:** Oscuro (#0f0f23)
- 🟣 **Botones:** Gradiente púrpura/azul
- 💎 **Cards:** Efecto glass (transparentes)
- 🔵 **Scrollbars:** Con gradiente
- 📱 **Fuente:** Plus Jakarta Sans

---

## 🚨 SI ALGO SALE MAL

### Error: "Build failed"
- Revisa los logs en Render
- Verifica que el build command es correcto
- Asegúrate de que `dist` existe después del build

### Error: "Not Found"
- Verifica que el "Publish Directory" es `./dist`
- Espera más tiempo (puede tardar 5-8 min)

### Error: "502 Bad Gateway"
- El backend está en proceso de deploy
- Espera 2-5 minutos

---

## 📊 RESUMEN DE LA CONFIGURACIÓN

| Servicio | Tipo | Build Command | Publish Dir | Variables |
|----------|------|---------------|-------------|-----------|
| matebudy | Node.js | `npm install --include=dev` | N/A | 8 variables |
| matebudy-1 | Static | `npm install && npm run build` | `./dist` | 4 variables |

---

**Una vez configurado, cada push a GitHub hará deploy automático de ambos servicios.**

**¿Puedes seguir estos pasos y avisarme cuando termine el deploy?**
