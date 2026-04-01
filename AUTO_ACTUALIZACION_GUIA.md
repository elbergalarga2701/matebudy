# 🔄 AUTO-ACTUALIZACIÓN DE LA APK - Realidad y Funcionamiento

## ⚠️ IMPORTANTE: Entender cómo funciona

### Lo que SÍ se actualiza automáticamente ✅

**El FRONTEND (código web dentro de la APK)** se actualiza solo cuando:
1. Haces un `npm run build` nuevo
2. El servidor tiene el archivo `update.json` actualizado
3. La APK está conectada al servidor

**Cómo funciona:**
- La APK consulta `/update.json` cada 60 segundos
- Si detecta un `buildId` diferente, recarga el frontend automáticamente
- El usuario ve una notificación "Aplicando la ultima version de Matebudy..."

### Lo que NO se actualiza automáticamente ❌

**La APK nativa (el contenedor Android)** NO puede actualizarse sola porque:
- Android no permite que una app se reemplace a sí misma
- Se necesita intervención del usuario o una tienda de apps
- Es una limitación de seguridad de Android

**Para actualizar la APK nativa necesitas:**
1. Generar nueva APK: `build-install.bat`
2. Enviar la nueva APK al usuario
3. El usuario debe instalar manualmente (o usar Google Play Store)

---

## 🛠️ CONFIGURAR AUTO-ACTUALIZACIÓN DEL FRONTEND

### Paso 1: Configurar URLs en `.env`

Para **desarrollo local**:
```env
VITE_API_URL=http://192.168.1.100:3000
VITE_SOCKET_URL=http://192.168.1.100:3000
VITE_UPDATE_URL=http://192.168.1.100:3000/update.json
```

Para **producción con túnel** (Cloudflare/ngrok):
```env
VITE_API_URL=https://tu-tunel.trycloudflare.com
VITE_SOCKET_URL=https://tu-tunel.trycloudflare.com
VITE_UPDATE_URL=https://tu-tunel.trycloudflare.com/update.json
```

Para **Render.com**:
```env
VITE_API_URL=https://matebudy.onrender.com
VITE_SOCKET_URL=https://matebudy.onrender.com
VITE_UPDATE_URL=https://matebudy.onrender.com/update.json
```

### Paso 2: Build y deploy

```bash
# 1. Hacer build del frontend
npm run build

# 2. Reiniciar servidor para que tome el nuevo build
# (El server lee el directorio dist/ al iniciar)

# 3. La APK detectará el cambio automáticamente
```

### Paso 3: Verificar que funciona

1. Abre la APK en tu teléfono
2. Ve a **Perfil** → Sección "Notificaciones y app"
3. Click en **"Buscar actualizacion"**
4. Si hay un build nuevo, verás: "Aplicando la ultima version de Matebudy..."
5. La app se recargará automáticamente

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### La APK no detecta actualizaciones

**Verifica:**
1. El servidor está accesible desde la APK
2. `/update.json` responde correctamente
3. El `buildId` es diferente al actual

**Comandos para verificar:**
```bash
# Ver update.json desde tu computadora
curl http://localhost:3000/update.json

# Desde la APK, usa Profile → Buscar actualización
```

### La APK usa URLs viejas

**Problema:** Las URLs están hardcodeadas en el build anterior

**Solución:**
1. Edita `.env` con las URLs correctas
2. Ejecuta `npm run build` nuevamente
3. La APK necesita reconstruirse para tomar nuevas URLs:
   ```bash
   npm run mobile:build
   ```

### Quieres cambiar el servidor de producción

**Opción 1: Rebuild completo (Recomendado)**
```bash
# 1. Editar .env.production
# 2. Cambiar VITE_API_URL, VITE_SOCKET_URL, VITE_UPDATE_URL
# 3. npm run build
# 4. npm run mobile:build
# 5. Instalar nueva APK
```

**Opción 2: Usar túnel temporal**
```bash
# 1. Iniciar túnel hacia tu servidor local
npx localtunnel --port 3000

# 2. Editar .env con la URL del túnel
# 3. npm run build
# 4. La APK existente funcionará con el nuevo servidor
```

---

## 📱 ACTUALIZAR APK NATIVA

Cuando necesites actualizar la APK (código nativo, no frontend):

### Método Manual (Sin Google Play)

1. **Generar nueva APK:**
   ```bash
   build-install.bat
   ```

2. **Enviar a usuarios:**
   - Sube la APK a Google Drive, Dropbox, etc.
   - Comparte el link de descarga
   - Los usuarios deben instalar manualmente

3. **Usuarios instalan:**
   - Descargan la APK
   - Android pedirá permiso para "Instalar apps desconocidas"
   - Aceptan e instalan

### Método Automático (Con Google Play Store)

1. **Generar APK de producción:**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

2. **Subir a Google Play Console**

3. **Usuarios reciben notificación de actualización**

---

## 🎯 RESUMEN RÁPIDO

| Qué se actualiza | Cómo | Automático |
|-----------------|------|------------|
| Frontend (web dentro de APK) | `npm run build` + server | ✅ SÍ |
| APK nativa (contenedor Android) | `build-install.bat` | ❌ NO |
| Íconos y assets nativos | Android Asset Studio | ❌ NO |

---

## 💡 CONSEJOS

1. **Para desarrollo:** Usa túneles (Cloudflare/ngrok) para probar en tu teléfono
2. **Para producción:** Sube a Render.com o usa tu propio servidor
3. **Para updates menores:** Solo rebuild del frontend (automático)
4. **Para cambios nativos:** Nueva APK (manual)

---

**Flujo recomendado:**
```
1. Haces cambios en el código
2. npm run build
3. npm start (reinicia server)
4. La APK detecta y actualiza sola en 1-2 minutos
5. Para cambios nativos: build-install.bat
```
