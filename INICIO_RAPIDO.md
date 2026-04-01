# ⚡ INICIO RÁPIDO - MATEBUDY

## 🚀 Para empezar en 3 pasos

### Paso 1: Instalar dependencias

```bash
npm install
```

### Paso 2: Generar configuración segura

```bash
npm run env:generate
```

Esto crea un archivo `.env` con secrets únicos y seguros.

### Paso 3: Iniciar servidor

```bash
# Windows (recomendado)
start-backend.bat

# O manualmente (2 terminales)
# Terminal 1 - Backend:
npm start

# Terminal 2 - Frontend:
npm run dev
```

---

## ✅ Verificar que funciona

1. **Frontend:** Abre http://localhost:5173
2. **Backend:** Abre http://localhost:3000/api/health
3. **Admin:** Abre http://localhost:5173/admin (código: `dev1234`)

---

## 📱 Build para Android (opcional)

```bash
# Build completo
npm run mobile:build

# O pasos individuales
npm run build        # Build frontend
npm run android:sync # Sincronizar Android
npm run android:open # Abrir Android Studio

# Instalar en dispositivo
build-install.bat
```

---

## 🧪 Ejecutar tests

```bash
npm test
```

---

## 🐳 Usar Docker (opcional)

```bash
# Build de imagen
npm run docker:build

# Ejecutar contenedor
npm run docker:run

# Ver logs
docker-compose logs -f

# Detener
npm run docker:stop
```

---

## 📚 Más información

- [README.md](./README.md) - Documentación completa
- [CAMBIOS_REALIZADOS.md](./CAMBIOS_REALIZADOS.md) - Cambios recientes
- [PRODUCT_LOGIC.md](./PRODUCT_LOGIC.md) - Lógica de negocio

---

## ⚠️ Problemas comunes

### Error: "JWT_SECRET no configurada"

Ejecuta `npm run env:generate` para crear un .env válido.

### Error: "Puerto 3000 ya está en uso"

Cambia el puerto en `.env`:
```
PORT=3001
```

### Error: "Cannot find module"

Ejecuta `npm install` nuevamente.

### Error: "ADB no encontrado"

Instala Android Studio o configura `ANDROID_HOME`.

---

## 🆘 Soporte

Si tienes problemas:
1. Revisa los logs en `logs/server.log`
2. Verifica que el `.env` esté configurado
3. Revisa [CAMBIOS_REALIZADOS.md](./CAMBIOS_REALIZADOS.md)

---

**¡Listo! A disfrutar MateBudy 🎉**
