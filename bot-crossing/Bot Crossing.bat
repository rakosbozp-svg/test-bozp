@echo off
rem Bot Crossing - dvojklikem spustis dashboard (Windows). Okno nech otevrene; zavrenim se dashboard vypne.
cd /d "%~dp0"
chcp 65001 >nul

where node >nul 2>nul
if errorlevel 1 (
  echo Chybi Node.js. Nainstaluj verzi LTS z https://nodejs.org a spust znovu.
  pause
  exit /b 1
)

rem Instalace pri prvnim spusteni a po aktualizaci (kdyz se zmeni package-lock.json).
node -e "const f=require('fs');process.exit(f.statSync('package-lock.json').mtimeMs>f.statSync('node_modules/.package-lock.json').mtimeMs?1:0)" 2>nul
if errorlevel 1 (
  echo Instaluji zavislosti - jen poprve nebo po aktualizaci, chvili to trva...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo Instalace selhala.
    pause
    exit /b 1
  )
)

if not exist ".data\setup.json" call npm run --silent setup

call npm start
pause
