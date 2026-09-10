@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\vite" (
  echo [Token Burner] Installing dependencies...
  call npm install --cache "%~dp0.npm-cache"
  if errorlevel 1 (
    echo.
    echo Installation failed. Check Node.js and your network, then retry.
    pause
    exit /b 1
  )
)

call npm run play
