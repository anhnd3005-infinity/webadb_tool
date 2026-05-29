@echo off
set PORT=3456
set PKG=com.app.live.tv.score.pro

echo =============================================
echo 📱 ADB Web Controller - Khoi dong Local Server
echo =============================================

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js chua duoc cai dat! Vui long tai tai https://nodejs.org/
    pause
    exit /b 1
)

:: Download server.js if not present
if not exist server.js (
    echo [INFO] Dang tai file server.js...
    powershell -Command "(New-Object Net.WebClient).DownloadFile('https://webadb-tool.vercel.app/server.js', 'server.js')"
)

:: Run Server
echo [INFO] Dang khoi chay Node.js server cho package: %PKG%...
node server.js %PKG%
pause
