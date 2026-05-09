@echo off
setlocal

cd /d "%~dp0"

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] pnpm is not installed or not in PATH.
  echo Install pnpm first, then run this file again.
  pause
  exit /b 1
)

set "CLOUDFLARED_CMD=cloudflared"
where cloudflared >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\cloudflared\cloudflared.exe" (
    set "CLOUDFLARED_CMD=%ProgramFiles%\cloudflared\cloudflared.exe"
  ) else if exist "%ProgramFiles(x86)%\cloudflared\cloudflared.exe" (
    set "CLOUDFLARED_CMD=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
  ) else (
    echo [ERROR] cloudflared is not installed or not in PATH.
    echo Install it with:
    echo   winget install --id Cloudflare.cloudflared -e
    pause
    exit /b 1
  )
)

set "CONFIG_FILE=%~dp0.cloudflared\config.yml"
set "PORT_FILE=%~dp0.cloudflared\app-port.txt"

if not exist "%CONFIG_FILE%" (
  echo [ERROR] Permanent tunnel config was not found:
  echo   %CONFIG_FILE%
  echo.
  echo Run this first:
  echo   setup-cloudflare-tunnel.bat
  pause
  exit /b 1
)

set "APP_PORT=3000"
if exist "%PORT_FILE%" set /p APP_PORT=<"%PORT_FILE%"

if not exist "dist\server\node-build.mjs" (
  echo Production build not found. Building now...
  call pnpm build
  if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
  )
)

echo Starting BayanTrack in PROD mode on http://127.0.0.1:%APP_PORT%
start "BayanTrack App (prod)" cmd /k "cd /d ""%~dp0"" && set PORT=%APP_PORT% && pnpm start"

echo Waiting for app server to be reachable on http://127.0.0.1:%APP_PORT% ...
set READY=
for /L %%i in (1,1,40) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%APP_PORT%' -TimeoutSec 1; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { if ($_.Exception.Response.StatusCode.value__ -ge 200 -and $_.Exception.Response.StatusCode.value__ -lt 500) { exit 0 } else { exit 1 } }" >nul 2>nul
  if not errorlevel 1 (
    set READY=1
    goto :START_TUNNEL
  )
  timeout /t 1 >nul
)

:START_TUNNEL
if not defined READY (
  echo [ERROR] App did not respond on http://127.0.0.1:%APP_PORT% within 40 seconds.
  echo Check the "BayanTrack App" window for startup errors, then run again.
  pause
  exit /b 1
)

echo App is reachable. Starting permanent Cloudflare tunnel...
start "BayanTrack Permanent Tunnel" "%CLOUDFLARED_CMD%" tunnel --config "%CONFIG_FILE%" run

echo.
echo Started.
echo Keep both opened windows running while this PC is serving BayanTrack.
echo.
pause

