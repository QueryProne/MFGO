@echo off
setlocal

set "ROOT=%~dp0"
pushd "%ROOT%" >nul

set "DB_CONTAINER=mfgos-pg"
set "DATABASE_URL=postgresql://postgres:postgres@localhost:55432/mfgos"
set "API_PORT=3000"
set "UI_PORT=5173"
set "BASE_PATH=/"

echo.
echo ===== MFGOS Startup =====
echo Root: %ROOT%
echo.

if not exist "node_modules" (
  echo [0/4] Installing dependencies...
  call corepack pnpm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Dependency install failed.
    popd >nul
    exit /b 1
  )
)

echo [1/5] Clearing stale dev processes on ports %API_PORT% and %UI_PORT%...
for %%P in (%API_PORT% %UI_PORT%) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    echo [INFO] Stopping process %%I on port %%P...
    taskkill /PID %%I /F >nul 2>&1
  )
)

echo [2/5] Starting PostgreSQL container "%DB_CONTAINER%"...
docker start "%DB_CONTAINER%" >nul 2>&1
if errorlevel 1 (
  echo [WARN] Could not start "%DB_CONTAINER%". It may already be running or Docker Desktop is not running.
)

echo [3/5] Applying database schema...
set "DATABASE_URL=%DATABASE_URL%"
call corepack pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo.
  echo [ERROR] Database schema push failed. Fix this first, then run this script again.
  popd >nul
  exit /b 1
)

echo [4/5] Starting API server on port %API_PORT%...
start "MFGOS API" cmd /k "cd /d ""%ROOT%"" && set PORT=%API_PORT% && set DATABASE_URL=%DATABASE_URL% && corepack pnpm --filter @workspace/api-server run dev"

echo [5/5] Starting ERP UI on port %UI_PORT%...
start "MFGOS UI" cmd /k "cd /d ""%ROOT%"" && set PORT=%UI_PORT% && set BASE_PATH=%BASE_PATH% && set VITE_API_BASE_URL=http://localhost:%API_PORT% && corepack pnpm --filter @workspace/erp run dev"

echo.
echo Startup commands launched.
echo API health: http://localhost:%API_PORT%/api/communications/versions
echo UI:         http://localhost:%UI_PORT%/
echo.
echo If a port is already in use, close old dev terminals and run this script again.

popd >nul
endlocal
