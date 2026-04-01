# MateBudy - Plataforma de Acompañamiento Emocional

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/your-org/matebudy)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-proprietary-red.svg)]()

> Aplicación de compañía emocional con geolocalización, chat en tiempo real y pagos seguros.

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Stack Tecnológico](#-stack-tecnológico)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Desarrollo](#-desarrollo)
- [Producción](#-producción)
- [Docker](#-docker)
- [Tests](#-tests)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Seguridad](#-seguridad)
- [Documentación Adicional](#-documentación-adicional)

## ✨ Características

- 🔐 **Autenticación segura** con JWT y refresh tokens
- 💬 **Chat en tiempo real** con WebSocket
- 📍 **Geolocalización** y mapas en tiempo real
- 💳 **Sistema de pagos** con Mercado Pago (modelo escrow)
- 👤 **Verificación KYC** con selfie y documento de identidad
- 📱 **App móvil** Android con Capacitor
- 🔔 **Notificaciones push** (opcional con Firebase)
- 🛡️ **Botón SOS** para emergencias
- 👁️ **Sistema de monitoreo** para familiares
- 📊 **Panel administrativo** para revisión de verificaciones

## 🛠️ Stack Tecnológico

### Frontend
- **React 18** con Vite
- **TailwindCSS** para estilos
- **React Router DOM** para navegación
- **Capacitor** para app móvil Android

### Backend
- **Node.js** con Express
- **Socket.io** para WebSocket
- **SQLite** (desarrollo) / **PostgreSQL** (producción)
- **JWT** para autenticación
- **bcryptjs** para hash de contraseñas

### Servicios Externos
- **Mercado Pago** - Pasarela de pagos
- **Firebase** - Notificaciones push (opcional)
- **Render.com** - Hosting backend

## 📦 Requisitos

### Desarrollo
- Node.js >= 18.0.0
- npm >= 9.0.0
- Android Studio (para build móvil)
- Java 21 (para Android)

### Producción
- Docker (opcional)
- PostgreSQL 15+ (recomendado)
- Dominio con HTTPS

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd matebudy
```

### 2. Generar archivo .env

```bash
npm run env:generate
```

Esto creará un archivo `.env` con secrets seguros. **Guarda este archivo en un lugar seguro.**

### 3. Instalar dependencias

```bash
npm install
```

### 4. Configurar variables adicionales (opcional)

Edita `.env` y configura:
- `MERCADO_PAGO_ACCESS_TOKEN` - Para pagos
- `FIREBASE_*` - Para notificaciones push
- `GOOGLE_MAPS_API_KEY` - Para mapas

## 💻 Desarrollo

### Iniciar servidor de desarrollo

```bash
# Opción 1: Usar script batch (Windows)
start-backend.bat

# Opción 2: Comandos manuales
npm run dev          # Frontend en http://localhost:5173
npm start            # Backend en http://localhost:3000
```

### Build móvil Android

```bash
# Build completo
npm run mobile:build

# O pasos individuales
npm run build        # Build frontend
npm run android:sync # Sincronizar con Android
npm run android:open # Abrir Android Studio
```

### Instalar APK en dispositivo

```bash
build-install.bat
```

## 🌍 Producción

### Variables de entorno requeridas

```bash
NODE_ENV=production
JWT_SECRET=<generar-secreto-seguro>
JWT_REFRESH_SECRET=<generar-secreto-seguro>
ADMIN_PANEL_CODE=<codigo-seguro>
DATABASE_URL=postgresql://user:pass@host:5432/matebudy
CORS_ALLOWED_ORIGINS=https://tudominio.com
```

### Deploy en Render.com

1. Conectar repositorio a Render
2. Configurar variables de entorno
3. Usar `render.yaml` para configuración automática

### Deploy con Docker

```bash
# Build de imagen
npm run docker:build

# Ejecutar con docker-compose
npm run docker:run

# Detener
npm run docker:stop
```

## 🧪 Tests

```bash
# Ejecutar tests
npm test

# Tests en modo watch
npm run test:watch

# Tests con cobertura
npm run test:coverage
```

## 📁 Estructura del Proyecto

```
MATEBUDY/
├── src/                    # Frontend React
│   ├── components/         # Componentes React
│   ├── api.js              # Cliente API
│   ├── AuthContext.jsx     # Contexto de autenticación
│   ├── App.jsx             # Componente principal
│   └── index.css           # Estilos globales
├── server/                 # Backend Express
│   ├── config/             # Configuración
│   │   ├── security.js     # Gestión de secrets
│   │   ├── paths.js        # Rutas de archivos
│   │   └── commission.js   # Configuración de comisiones
│   ├── middleware/         # Middleware
│   │   └── rateLimiter.js  # Rate limiting
│   ├── routes/             # Rutas API
│   │   ├── auth.js         # Autenticación
│   │   ├── chat.js         # Chat
│   │   ├── users.js        # Usuarios
│   │   ├── posts.js        # Publicaciones
│   │   ├── payments.js     # Pagos
│   │   ├── locations.js    # Geolocalización
│   │   ├── sos.js          # Alertas SOS
│   │   └── admin.js        # Panel admin
│   ├── utils/              # Utilidades
│   │   ├── logger.js       # Logging estructurado
│   │   └── backup.js       # Backups de DB
│   ├── db.js               # Configuración de DB
│   └── index.js            # Entry point backend
├── tests/                  # Tests automatizados
├── scripts/                # Scripts utilitarios
│   ├── generate-env.js     # Generar .env seguro
│   └── backup-db.js        # Backup de DB
├── uploads/                # Archivos subidos (gitignore)
├── backups/                # Backups de DB (gitignore)
├── dist/                   # Build de producción (gitignore)
├── android/                # Proyecto Android (gitignore)
└── docs/                   # Documentación
```

## 🔒 Seguridad

### Secrets y Variables Sensibles

**NUNCA** commits archivos con secrets:
- `.env` - Variables de entorno
- `*.sqlite` - Bases de datos
- `uploads/` - Archivos de usuarios
- `backups/` - Backups de DB

### Configuración Segura

1. **Generar secrets únicos** para cada entorno:
   ```bash
   npm run env:generate
   ```

2. **Usar HTTPS** en producción

3. **Configurar CORS** correctamente:
   ```bash
   CORS_ALLOWED_ORIGINS=https://tudominio.com
   ```

4. **Rate limiting** activado por defecto

5. **Backups automáticos** cada 24 horas

### Auditoría de Seguridad

- [ ] Secrets hardcoded eliminados
- [x] Rate limiting implementado
- [x] CORS configurado correctamente
- [x] Logging estructurado
- [x] Backups automáticos
- [ ] Validación de email (pendiente)
- [ ] PostgreSQL para producción (configurado, opcional)

## 📚 Documentación Adicional

- [PRODUCT_LOGIC.md](./PRODUCT_LOGIC.md) - Lógica de negocio detallada
- [APK_BUILD_STEPS.md](./APK_BUILD_STEPS.md) - Pasos para build de APK
- [MOBILE_URUGUAY_SETUP.md](./MOBILE_URUGUAY_SETUP.md) - Setup para Uruguay
- [PC_PUBLIC_SERVER_SETUP.md](./PC_PUBLIC_SERVER_SETUP.md) - Setup de servidor público
- [QUICK_TUNNEL_RUNBOOK.md](./QUICK_TUNNEL_RUNBOOK.md) - Uso de Cloudflare Tunnel

## 🤝 Contribuir

1. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
2. Commit cambios (`git commit -m 'Añadir nueva funcionalidad'`)
3. Push a rama (`git push origin feature/nueva-funcionalidad`)
4. Abrir Pull Request

## 📄 Licencia

Propietario. Todos los derechos reservados.

## 📞 Soporte

Para soporte técnico, contactar a:
- Email: soporte@matebudy.com
- Documentación: `/docs`

---

**Hecho con ❤️ para MateBudy**
