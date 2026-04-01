# 🚀 DEPLOY AUTOMÁTICO A RENDER - GUÍA RÁPIDA

## ✅ CONFIGURADO Y LISTO

Tus deploy hooks están configurados en el script de deploy.

---

## 📝 PARA HACER DEPLOY (3 SEGUNDOS)

### Opción 1: Deploy de TODO (Backend + Frontend)

```bash
npm run deploy
```

**Esto hace:**
1. Build del frontend automáticamente
2. Notifica a Render para redeployar el backend
3. Notifica a Render para redeployar el frontend

---

### Opción 2: Deploy solo Backend

```bash
npm run deploy:backend
```

**Usa esto cuando:**
- Cambiaste algo del servidor (archivos en `server/`)
- No cambiaste el frontend

---

### Opción 3: Deploy solo Frontend

```bash
npm run deploy:frontend
```

**Esto hace:**
1. Build del frontend automáticamente
2. Notifica a Render para redeployar

**Usa esto cuando:**
- Cambiaste algo del frontend (archivos en `src/`)
- No cambiaste el backend

---

## 🎯 FLUJO COMPLETO DE TRABAJO

### Cuando hagas cambios en el código:

```bash
# 1. Haces tus cambios en el código
#    Ej: editas src/components/Feed.jsx

# 2. Haces deploy
npm run deploy

# 3. Esperas 2-5 minutos
#    Render está desplegando...

# 4. La APK detecta el cambio en 60 segundos
#    Los usuarios reciben la actualización automáticamente

# 5. ¡LISTO!
```

---

## 📊 ¿QUÉ PASA CUANDO EJECUTAS `npm run deploy`?

```
┌─────────────────────────────────────────────────────────┐
│ npm run deploy                                          │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ 1. Build del frontend (dist/)                           │
│    Tiempo: ~10-30 segundos                              │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. POST a Render Backend Hook                           │
│    Render inicia deploy del backend                     │
│    Tiempo: 2-5 minutos                                  │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. POST a Render Frontend Hook                          │
│    Render inicia deploy del frontend                    │
│    Tiempo: 1-3 minutos                                  │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Render termina ambos deploys                         │
│    Tus servicios están actualizados                     │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ 5. La APK consulta /update.json (cada 60 seg)          │
│    Detecta el nuevo buildId                             │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ 6. APK muestra: "Aplicando la ultima version..."        │
│    Se recarga automáticamente                           │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ 7. ¡USUARIOS TIENEN LA NUEVA VERSIÓN!                   │
│    Sin descargar APK, sin hacer nada                    │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 VERIFICAR QUE EL DEPLOY FUNCIONÓ

### 1. Ver en Render Dashboard:
```
https://dashboard.render.com
```

### 2. Verificar Backend:
```bash
curl https://matebudy.onrender.com/api/health
```

### 3. Verificar Update JSON:
```bash
curl https://matebudy.onrender.com/update.json
```

### 4. Verificar Frontend:
Abre en tu navegador:
```
https://matebudy-1.onrender.com
```

---

## ⏱️ TIEMPOS ESTIMADOS

| Paso | Tiempo |
|------|--------|
| Build frontend | 10-30 seg |
| Deploy backend | 2-5 min |
| Deploy frontend | 1-3 min |
| Detección en APK | 60 seg |
| **TOTAL** | **~5-10 min** |

---

## ⚠️ NOTAS IMPORTANTES

### 1. El servidor local NO afecta a Render
- Tu servidor en tu computadora es independiente
- Render tiene su propia versión desplegada
- Los cambios locales NO se suben automáticamente

### 2. Necesitas hacer deploy manualmente
- Cada cambio requiere ejecutar `npm run deploy`
- No hay auto-deploy desde tu computadora
- El script hace todo fácil con un comando

### 3. Los usuarios esperan ~10 minutos
- Desde que haces deploy hasta que la APK se actualiza
- La mayoría del tiempo es Render desplegando
- La APK detecta en 60 segundos automáticamente

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### Error: "Deploy hook no encontrado"
- Verifica que el archivo `scripts/deploy-render.js` exista
- Verifica que los hooks estén configurados correctamente

### Error: "npm run deploy" no funciona
- Ejecuta: `npm install` primero
- Verifica que Node.js esté instalado: `node --version`

### Render no despliega después del hook
- Revisa el dashboard de Render
- Puede haber un error en el build
- Revisa los logs en Render

### La APK no detecta el cambio
- Espera al menos 10 minutos después del deploy
- Verifica que el buildId cambió: `curl https://matebudy.onrender.com/update.json`
- Reinicia la APK (cierra y abre)

---

## 📋 COMANDOS DISPONIBLES

| Comando | Qué hace | Cuándo usar |
|---------|----------|-------------|
| `npm run deploy` | Deploy completo (backend + frontend) | Cambios generales |
| `npm run deploy:backend` | Solo backend | Cambios en `server/` |
| `npm run deploy:frontend` | Solo frontend (con build) | Cambios en `src/` |
| `npm run build` | Solo build local | Testing local |
| `npm run mobile:build` | Build + sync Android | Cambios en la APK nativa |

---

## 🎯 EJEMPLO DE USO DIARIO

```bash
# 1. Haces cambios en el código
#    Ej: Agregas una función nueva en src/components/Feed.jsx

# 2. Guardas los archivos

# 3. Haces deploy:
npm run deploy:frontend

# 4. Esperas a que termine (verás los logs)

# 5. Verificas en Render:
#    https://dashboard.render.com

# 6. ¡Listo! Los usuarios recibirán la actualización
```

---

**Documento creado:** Abril 2026  
**Estado:** ✅ Deploy hooks configurados  
**Scripts listos:** ✅ `npm run deploy`
