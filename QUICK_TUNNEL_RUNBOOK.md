# Quick Tunnel actual de MateBudy

## URL publica activa

`https://bell-shaw-smart-pool.trycloudflare.com`

## Estado comprobado

Se verifico respuesta externa en:

`https://bell-shaw-smart-pool.trycloudflare.com/api/health`

## Para que sirve esta URL

- conecta la APK con tu backend
- permite probar la app desde celulares fuera de tu red
- te deja avanzar sin comprar dominio ni hosting

## Importante

Esta URL depende de que:

- tu PC siga encendida
- el backend local siga corriendo en `3000`
- `cloudflared` siga corriendo

Si el quick tunnel se corta, Cloudflare puede darte otra URL distinta y habra que actualizar `.env.production` y regenerar la APK.

## Como volver a levantarlo

### 1. Backend

```powershell
cd c:\Users\ianja\OneDrive\Escritorio\MATEBUDY\server
npm start
```

### 2. Quick Tunnel

```powershell
& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel --url http://127.0.0.1:3000
```

Cloudflare te devolvera una URL `https://...trycloudflare.com`

### 3. Si la URL cambia

Actualiza [/.env.production](/c:/Users/ianja/OneDrive/Escritorio/MATEBUDY/.env.production) con la nueva URL y vuelve a generar Android:

```powershell
npm run mobile:build
```

## Siguiente prueba recomendada

1. abrir la APK en un Android
2. registrarse
3. entrar al chat
4. probar perfil, muro y adjuntos
5. probar desde datos moviles, no solo Wi-Fi
