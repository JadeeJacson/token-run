@echo off
title Token Run 2.0
cd /d "%~dp0"

echo ============================================
echo  Token Run 2.0 launcher
echo  Path: %cd%
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node 20+ and reopen terminal.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODE_V=%%v
echo [OK] Node %NODE_V%

if not exist "node_modules\vite" (
  echo [....] First run: installing dependencies...
  if exist "package-lock.json" (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. Check network, then retry.
    pause
    exit /b 1
  )
  echo [OK] Dependencies installed
) else (
  echo [OK] Dependencies already present
)

echo.
echo [....] Starting dev server...
echo        URL: http://127.0.0.1:5173/
echo        If browser does not open, visit the URL manually.
echo        Closing this window stops the game.
echo.

call npm run play
set EXITCODE=%ERRORLEVEL%
echo.
echo [EXIT] npm run play exited with code %EXITCODE%
if not "%EXITCODE%"=="0" (
  echo [ERROR] Launch failed. Common fixes:
  echo   1^) Port 5173 busy - try: npm run dev -- --port 5174
  echo   2^) npm not on PATH - reinstall Node, open new terminal
  echo   3^) Broken modules - delete node_modules and rerun this script
)
echo.
pause
exit /b %EXITCODE%
