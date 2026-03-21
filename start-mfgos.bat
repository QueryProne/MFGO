@echo off
setlocal EnableExtensions

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
  echo [0/6] Installing dependencies...
  call corepack pnpm install
  if errorlevel 1 (
    echo [ERROR] Dependency install failed.
    popd >nul
    exit /b 1
  )
)

echo [1/6] Clearing stale dev processes on ports %API_PORT% and %UI_PORT%...
for %%P in (%API_PORT% %UI_PORT%) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    taskkill /PID %%I /F >nul 2>&1
  )
)

echo [2/6] Starting PostgreSQL container "%DB_CONTAINER%"...
docker start "%DB_CONTAINER%" >nul 2>&1

echo [3/6] Waiting for PostgreSQL readiness...
set "DB_READY=0"
for /L %%N in (1,1,30) do (
  docker exec "%DB_CONTAINER%" pg_isready -U postgres -d mfgos >nul 2>&1
  if not errorlevel 1 (
    set "DB_READY=1"
    goto :db_ready
  )
  timeout /t 1 >nul
)

:db_ready
if "%DB_READY%"=="0" (
  echo [ERROR] PostgreSQL is not ready. Verify Docker Desktop and container "%DB_CONTAINER%".
  popd >nul
  exit /b 1
)

echo [4/6] Applying database schema...
set "DATABASE_URL=%DATABASE_URL%"
call corepack pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo [ERROR] Database schema push failed.
  popd >nul
  exit /b 1
)

echo [5/6] Starting ERP UI in a new terminal...
start "MFGOS UI" cmd /k "cd /d ""%ROOT%"" && set ""PORT=%UI_PORT%"" && set ""BASE_PATH=%BASE_PATH%"" && set ""VITE_API_BASE_URL=http://localhost:%API_PORT%"" && corepack pnpm --filter @workspace/erp run dev"

echo [6/6] Starting API server in this terminal...
echo.
echo Keep this terminal open.
echo UI:         http://localhost:%UI_PORT%/
echo API health: http://localhost:%API_PORT%/api/communications/versions
echo.

set "PORT=%API_PORT%"
set "DATABASE_URL=%DATABASE_URL%"
corepack pnpm --filter @workspace/api-server run dev

popd >nul
endlocal
