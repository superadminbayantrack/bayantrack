@echo off
setlocal

cd /d "%~dp0"

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

set "TUNNEL_NAME=bayan-track"
set /p "TUNNEL_NAME=Tunnel name [bayan-track]: "
if "%TUNNEL_NAME%"=="" set "TUNNEL_NAME=bayan-track"

set "HOSTNAME="
set /p "HOSTNAME=Public hostname/subdomain (example: bayantrack.example.com): "
if "%HOSTNAME%"=="" (
  echo [ERROR] Hostname is required for a permanent tunnel.
  pause
  exit /b 1
)

set "APP_PORT=3000"
set /p "APP_PORT=Local app port [3000]: "
if "%APP_PORT%"=="" set "APP_PORT=3000"

set "USER_CLOUDFLARED=%USERPROFILE%\.cloudflared"
set "PROJECT_CLOUDFLARED=%~dp0.cloudflared"
set "CRED_FILE=%USER_CLOUDFLARED%\%TUNNEL_NAME%.json"
set "CONFIG_FILE=%PROJECT_CLOUDFLARED%\config.yml"
set "PORT_FILE=%PROJECT_CLOUDFLARED%\app-port.txt"

if not exist "%USER_CLOUDFLARED%" mkdir "%USER_CLOUDFLARED%"
if not exist "%PROJECT_CLOUDFLARED%" mkdir "%PROJECT_CLOUDFLARED%"

if not exist "%USER_CLOUDFLARED%\cert.pem" (
  echo.
  echo Cloudflare login is needed for named/permanent tunnels.
  echo A browser window will open. Log in and select the domain you want to use.
  echo.
  call "%CLOUDFLARED_CMD%" tunnel login
  if errorlevel 1 (
    echo [ERROR] Cloudflare login failed or was cancelled.
    pause
    exit /b 1
  )
)

if exist "%CRED_FILE%" (
  echo.
  echo Reusing existing tunnel credentials:
  echo   %CRED_FILE%
) else (
  echo.
  echo Creating tunnel "%TUNNEL_NAME%"...
  call "%CLOUDFLARED_CMD%" tunnel create --credentials-file "%CRED_FILE%" "%TUNNEL_NAME%"
  if errorlevel 1 (
    echo.
    echo [ERROR] Could not create the tunnel.
    echo If a tunnel with this name already exists, delete it in Cloudflare or choose another name.
    pause
    exit /b 1
  )
)

for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-Content -Raw '%CRED_FILE%' | ConvertFrom-Json).TunnelID"') do set "TUNNEL_ID=%%I"
if "%TUNNEL_ID%"=="" (
  echo [ERROR] Could not read TunnelID from:
  echo   %CRED_FILE%
  pause
  exit /b 1
)

echo.
echo Creating/updating DNS route:
echo   %HOSTNAME% --^> %TUNNEL_ID%
call "%CLOUDFLARED_CMD%" tunnel route dns "%TUNNEL_ID%" "%HOSTNAME%"
if errorlevel 1 (
  echo.
  echo [ERROR] Could not create DNS route.
  echo Make sure the domain is added to your Cloudflare account.
  pause
  exit /b 1
)

(
  echo tunnel: %TUNNEL_ID%
  echo credentials-file: '%CRED_FILE%'
  echo.
  echo ingress:
  echo   - hostname: %HOSTNAME%
  echo     service: http://127.0.0.1:%APP_PORT%
  echo   - service: http_status:404
) > "%CONFIG_FILE%"

> "%PORT_FILE%" echo %APP_PORT%

echo.
echo Done. Permanent tunnel config saved:
echo   %CONFIG_FILE%
echo.
echo To run BayanTrack through your permanent Cloudflare hostname:
echo   run-permanent-tunnel.bat
echo.
pause

