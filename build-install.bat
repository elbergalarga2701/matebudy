@echo off
echo =====================================
echo   MateBudy - Compilar e Instalar APK
echo =====================================
echo.
cd /d "%~dp0"
echo [1/4] Construyendo frontend...
call npm run build
echo.
echo [2/4] Sincronizando con Android...
call npx cap sync android
echo.
echo [3/4] Compilando APK...
cd android
call gradlew.bat assembleDebug
echo.
echo [4/4] Instalando en telefono...
"C:\Users\ianja\AppData\Local\Android\Sdk\platform-tools\adb.exe" install -r "C:\Users\ianja\OneDrive\Escritorio\MATEBUDY\android\app\build\outputs\apk\debug\app-debug.apk"
echo.
echo =====================================
echo   Listo! APK instalada.
echo =====================================
pause
