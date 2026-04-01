# Como sacar la APK de MateBudy

## Estado actual

La app ya tiene:

- proyecto Android con Capacitor
- backend publico por quick tunnel
- `VITE_API_URL` apuntando al backend publico
- permisos base para internet, camara, audio, archivos y ubicacion

## Opcion 1. Desde Android Studio

```powershell
npm run android:open
```

Luego en Android Studio:

1. espera a que sincronice Gradle
2. menu `Build`
3. `Build Bundle(s) / APK(s)`
4. `Build APK(s)`

La APK debug quedara dentro de:

`android/app/build/outputs/apk/debug/`

## Opcion 2. Desde terminal

```powershell
npm run android:debug
```

Si el entorno Android esta completo, generara:

`android/app/build/outputs/apk/debug/app-debug.apk`

## Si falla por Java o Android SDK

### Java

Para este proyecto Android funciono mejor Java 21.

Ruta instalada en esta maquina:

`C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot`

### Android SDK

Si Gradle dice `SDK location not found`:

1. abre Android Studio una vez
2. deja que instale Android SDK y build-tools
3. copia [android/local.properties.example](/c:/Users/ianja/OneDrive/Escritorio/MATEBUDY/android/local.properties.example) a `android/local.properties`
4. confirma que `sdk.dir` apunte a tu SDK real
5. vuelve a correr `npm run android:debug`

## Antes de recompilar

Si cambia la URL publica del tunel:

1. actualiza [/.env.production](/c:/Users/ianja/OneDrive/Escritorio/MATEBUDY/.env.production)
2. corre:

```powershell
npm run mobile:build
```

3. luego genera la APK de nuevo

## Recordatorio operativo

La APK actual funciona mientras:

- tu backend local siga corriendo
- el quick tunnel siga activo
- la URL del tunel siga siendo la misma
