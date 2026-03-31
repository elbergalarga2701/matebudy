@echo off
echo =====================================
echo   MateBudy - Iniciar Servidor
echo =====================================
echo.
echo [1] Iniciando backend local...
start "MateBudy Backend" powershell -NoExit -Command "cd C:\Users\ianja\OneDrive\Escritorio\MATEBUDY\server; npm run dev"
timeout /t 3 /nobreak >nul
echo [2] Iniciando tunel publico (localtunnel)...
start "MateBudy Tunnel" powershell -NoExit -Command "npx localtunnel --port 3000"
echo.
echo =====================================
echo   Backend: http://localhost:3000
echo   Panel admin: http://localhost:5173/admin
echo   Tunel publico: ver ventana 'Tunnel'
echo =====================================
echo.
echo NO CIERRES las ventanas de PowerShell
echo mientras la app este en uso.
pause
