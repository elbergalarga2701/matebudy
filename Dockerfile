# =============================================================================
# MATEBUDY - Dockerfile
# =============================================================================
# Imagen oficial de Node.js 20 (LTS)
FROM node:20-alpine

# Instalar dependencias de sistema necesarias
RUN apk add --no-cache python3 make g++ sqlite

# Crear directorio de trabajo
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies para el build)
RUN npm install

# Copiar el resto del código
COPY . .

# Crear directorios necesarios
RUN mkdir -p uploads logs backups dist

# Build del frontend
RUN npm run build

# Instalar dependencias del servidor
RUN cd server && npm install

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV LOG_FILE=/app/logs/server.log

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Usuario no root (seguridad)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Comando de inicio
CMD ["sh", "-c", "cd server && npm start"]
