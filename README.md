# Mate Community

App de compañía emocional con geolocalización, chat en tiempo real y pagos seguros.

## 🚀 Inicio Rápido

### Backend
```bash
cd server
npm install
cp .env.example .env  # Configurar variables
npm start
```

### Frontend
```bash
npm install
npm run dev  # Desarrollo
npm run build  # Producción
```

## 📋 Variables de Entorno

### Backend (.env)
```
JWT_SECRET=tu_jwt_secret
JWT_REFRESH_SECRET=tu_refresh_secret
NODE_ENV=production
```

### Frontend (.env)
```
VITE_API_URL=https://tu-api.com/api
VITE_SOCKET_URL=https://tu-api.com
```

## 🏗️ Arquitectura

- **Frontend:** Vanilla JS + Vite, PWA
- **Backend:** Express + SQLite, Socket.io
- **Estilos:** Glassmorphism/Neumorphism
- **Estado:** Store con IndexedDB
- **API:** REST + WebSocket

## 📱 Características

- ✅ Autenticación JWT + refresh tokens
- ✅ Chat en tiempo real con Socket.io
- ✅ Geolocalización y mapas
- ✅ Sistema de pagos/escrow
- ✅ Verificación KYC con encriptación
- ✅ PWA offline-first
- ✅ Diseño mobile-first

## 🚢 Despliegue

### Backend (Railway)
```bash
railway init
railway up
```

### Frontend (Vercel)
```bash
vercel --prod
```

## 🧪 Tests

```bash
npm test  # Manual por ahora
```

## 📊 Bundle Size
- JS: ~200KB gzipped
- CSS: ~6KB gzipped

## 🎯 Próximos Pasos
- [ ] Tests automatizados
- [ ] CI/CD pipeline
- [ ] Monitoring con Sentry
- [ ] Push notifications
- [ ] Multi-idioma