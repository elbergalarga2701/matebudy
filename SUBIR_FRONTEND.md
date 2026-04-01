# 🚀 SUBIR FRONTEND A RENDER MANUALMENTE

## Problema
El deploy automático no está funcionando. Necesitas subir el build manualmente.

---

## ✅ SOLUCIÓN RÁPIDA

### Opción 1: Drag & Drop (Más fácil)

1. **Ve a:** https://app.netlify.com/drop
2. **Arrastra la carpeta** `dist` completa
3. **Netlify te dará una URL** temporal
4. **Usa esa URL** o conéctala a tu dominio

### Opción 2: Render Static Sites

1. **Ve a:** https://dashboard.render.com
2. **Click "New +"** → "Static Site"
3. **Conecta tu repo** de GitHub
4. **Configura:**
   - **Name:** matebudy-frontend
   - **Branch:** main
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
5. **Click "Create static site"**
6. **Espera 3-5 minutos**

### Opción 3: Vercel (Recomendado)

1. **Ve a:** https://vercel.com/new
2. **Importa tu repo** de GitHub
3. **Configura:**
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** `dist`
4. **Click "Deploy"**
5. **Espera 2-3 minutos**

---

## 📁 ARCHIVOS LISTOS PARA SUBIR

Los archivos están en:
```
c:\Users\ianja\OneDrive\Escritorio\MATEBUDY\dist\
```

Contenido:
- index.html
- assets/ (CSS y JS con el nuevo diseño)
- icons/
- logo-heart-mate.svg
- manifest.json
- service-worker.js

---

## 🎨 VERIFICAR QUE EL NUEVO DISEÑO ESTÁ

El CSS debe tener:
- ✅ `#0f0f23` (fondo oscuro)
- ✅ `#667eea` (púrpura)
- ✅ `#764ba2` (violeta)
- ✅ `Plus Jakarta Sans` (fuente)
- ✅ `primary-gradient` (gradientes)

---

## ⚡ TESTING LOCAL

Para ver el diseño antes de subir:

```bash
npm run preview
```

Abre: http://localhost:4173

---

**Una vez subido, comparte la URL y verificamos que se vea el nuevo diseño.**
