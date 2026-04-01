# 🎨 CONFIGURAR ÍCONO DE LA APK - MateBudy

## Problema
La APK muestra el ícono genérico de Android en lugar del logo de MateBudy (mate con corazón).

## Solución Paso a Paso

### Opción 1: Usar Android Asset Studio (Recomendado - Gratis)

1. **Abrir Android Asset Studio Online:**
   - Ve a: https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html
   - O usa: https://icon.kitchen/ (más moderno)

2. **Subir tu logo:**
   - Necesitas una imagen cuadrada (1024x1024 recomendado)
   - Si no tienes el logo, crea uno en https://canva.com (gratis)
   - Sube la imagen del mate con corazón

3. **Generar íconos:**
   - Elige forma: Redonda o cuadrada
   - Ajusta márgenes si es necesario
   - Click en "Download" para descargar el ZIP

4. **Extraer ZIP:**
   - Descomprime el archivo descargado
   - Verás carpetas como: `mipmap-hdpi`, `mipmap-mdpi`, etc.

5. **Copiar archivos a tu proyecto:**
   ```
   Copia TODAS las carpetas mipmap-* a:
   MATEBUDY\android\app\src\main\res\
   ```

6. **Rebuild de la APK:**
   ```bash
   npm run build
   npm run android:sync
   npm run android:open
   ```
   
   O usa:
   ```bash
   build-install.bat
   ```

### Opción 2: Crear ícono manualmente (Más control)

1. **Prepara tu imagen:**
   - Crea un diseño 1024x1024 en Canva o similar
   - Logo: Mate con corazón
   - Fondo: Usa los colores de MateBudy (#789461 verde)

2. **Redimensiona a los tamaños necesarios:**
   - `mipmap-mdpi/`: 48x48
   - `mipmap-hdpi/`: 72x72
   - `mipmap-xhdpi/`: 96x96
   - `mipmap-xxhdpi/`: 144x144
   - `mipmap-xxxhdpi/`: 192x192

3. **Crea las carpetas si no existen:**
   ```bash
   mkdir android\app\src\main\res\mipmap-hdpi
   mkdir android\app\src\main\res\mipmap-mdpi
   mkdir android\app\src\main\res\mipmap-xhdpi
   mkdir android\app\src\main\res\mipmap-xxhdpi
   mkdir android\app\src\main\res\mipmap-xxxhdpi
   ```

4. **Copia los íconos:**
   - `ic_launcher.png` en cada carpeta con el tamaño correspondiente
   - `ic_launcher_round.png` (versión redonda) en cada carpeta

### Opción 3: Usar Capacitor Assets Generator

```bash
# Instalar herramienta
npm install -g @capacitor/assets

# Generar automáticamente (necesitas icon.png y icon.svg en la raíz)
npx @capacitor/assets generate --android
```

## Verificación

Después de copiar los íconos:

1. Abre Android Studio
2. Click derecho en `android` → "Open in Android Studio"
3. Espera que sincronice Gradle
4. Build → "Rebuild Project"
5. Ejecuta en tu dispositivo

El nuevo ícono debería aparecer en tu teléfono.

## Notas Importantes

- ⚠️ **NO** uses íconos con derechos de autor
- ✅ Usa siempre imágenes de alta resolución (1024x1024 mínimo)
- ✅ Mantén el diseño simple y reconocible
- ✅ Prueba el ícono en diferentes fondos (claro/oscuro)

## Solución de Problemas

### El ícono no cambia después de instalar
1. Desinstala completamente la APK anterior
2. Limpia caché de Android Studio: Build → "Clean Project"
3. Rebuild: Build → "Rebuild Project"
4. Instala la nueva APK

### Ícono se ve borroso
- Usa imágenes de mayor resolución
- Asegúrate de copiar a TODAS las carpetas mipmap-*

### Error en Android Studio
- Verifica que `ic_launcher.png` y `ic_launcher_round.png` existan
- Sync Gradle: File → "Sync Project with Gradle Files"

---

**Recursos Gratuitos:**
- Canva: https://canva.com (diseño del logo)
- Android Asset Studio: https://romannurik.github.io/AndroidAssetStudio/
- Icon Kitchen: https://icon.kitchen/
- Capacitor Assets: https://capacitorjs.com/docs/guides/creating-icons
