# ⚠️ ACCIÓN REQUERIDA: Actualizar Render.yaml

## Problema Detectado

El archivo `render.yaml` no tenía configurado el servicio estático para el frontend. Esto causa que el frontend no se despliegue correctamente.

---

## ✅ SOLUCIÓN APLICADA

El archivo `render.yaml` ha sido actualizado con:

1. **Backend API** (ya existía)
2. **Frontend Static** (nuevo - agregado ahora)

---

## 🔧 PASOS MANUALES EN RENDER

### Necesitas hacer esto UNA VEZ:

1. **Ve a:** https://dashboard.render.com
2. **Selecciona tu proyecto** `matebudy`
3. **Click en "New +"** → "Blueprint"
4. **Conecta tu repositorio** de GitHub (si no está conectado)
5. **Render detectará** el archivo `render.yaml`
6. **Click en "Apply"** para crear ambos servicios

### O si ya tienes los servicios creados:

1. **Ve al servicio** `matebudy-frontend` (static)
2. **Click en "Settings"**
3. **Scroll a "Build & Deploy"**
4. **En "Build Command"** pon: `npm install && npm run build`
5. **En "Publish Directory"** pon: `./dist`
6. **Click en "Manual Deploy"** → "Deploy latest commit"

---

## 📊 CONFIGURACIÓN DEL FRONTEND

Estos son los valores que debe tener el servicio estático:

| Campo | Valor |
|-------|-------|
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `./dist` |
| **VITE_API_URL** | `https://matebudy.onrender.com` |
| **VITE_SOCKET_URL** | `https://matebudy.onrender.com` |
| **VITE_UPDATE_URL** | `https://matebudy.onrender.com/update.json` |

---

## ✅ VERIFICAR DESPUÉS DE CONFIGURAR

1. **Espera 3-5 minutos** (tiempo de deploy)
2. **Ve a:** https://matebudy-1.onrender.com
3. **Deberías ver:** La app con el nuevo diseño
4. **Limpia caché** si es necesario (Ctrl+Shift+Supr)

---

## 🚀 DEPLOY AUTOMÁTICO FUTURO

Una vez configurado, cada push a GitHub hará:

```
Push → Render detecta → Build automático → Deploy en 3-5 min
```

No necesitarás hacer nada manual.

---

## 📝 COMANDOS LOCALES (para testing)

```bash
# Build local
npm run build

# Verificar build
npm run preview

# Deploy manual (si no usas GitHub)
node scripts/deploy-render.js
```

---

## ⚠️ IMPORTANTE

**El render.yaml NO hace deploy automático por sí solo.**

Necesitas:
1. Conectar GitHub a Render
2. O hacer deploy manual desde el dashboard

---

**Una vez configurado en Render, avísame y verificamos que el nuevo diseño se vea correctamente.**
