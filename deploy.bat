@echo off
setlocal EnableDelayedExpansion

echo =================================================================
echo   College Lost ^& Found Management System - Deployment
echo =================================================================
echo.

:: 1. Verify Docker CLI is available
echo [1/8] Verifying Docker CLI availability...
docker --version > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH!
    echo Please install Docker Desktop and ensure docker.exe is accessible.
    exit /b 1
)
for /f "tokens=*" %%v in ('docker --version') do echo [OK] Found: %%v
echo.

:: 2. Verify Docker Engine is running
echo [2/8] Verifying Docker Engine status...
docker info > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Engine is not running!
    echo Please start Docker Desktop and ensure the engine is active.
    exit /b 1
)
echo [OK] Docker Engine is running.
echo.

:: 3. Verify backend/.env configuration file exists
echo [3/8] Verifying environment configuration...
if not exist "backend\.env" (
    echo [ERROR] backend\.env file is missing!
    echo Please ensure backend\.env is configured before deploying.
    exit /b 1
)
echo [OK] backend\.env file found.
echo.

:: 4. Validate Docker Compose configuration
echo [4/8] Validating docker-compose configuration...
docker compose config -q
if %errorlevel% neq 0 (
    echo [ERROR] docker-compose configuration validation failed!
    exit /b 1
)
echo [OK] docker-compose.yml configuration is valid.
echo.

:: 5. Build Docker images
echo [5/8] Building Docker container images...
docker compose build
if %errorlevel% neq 0 (
    echo [ERROR] Docker image build failed!
    exit /b 1
)
echo [OK] Docker images built successfully.
echo.

:: 6. Start deployment in background
echo [6/8] Starting container deployment...
docker compose up -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Docker Compose services!
    exit /b 1
)
echo [OK] Containers started. Waiting briefly for services to initialize...
timeout /t 5 /nobreak > nul 2>&1 || ping 127.0.0.1 -n 6 > nul
echo.

:: 7. Display container status
echo [7/8] Current container status:
docker compose ps
echo.

:: 8. Verify service endpoints
echo [8/8] Verifying service endpoints...
echo.

echo --- Verifying Backend Health (port 5000) ---
for /f %%A in ('curl.exe -s -o nul -w "%%{http_code}" --max-time 10 http://localhost:5000/') do set "BACKEND_CODE=%%A"
if not "!BACKEND_CODE!"=="200" (
    echo [ERROR] Backend health check failed with HTTP status: !BACKEND_CODE!
    exit /b 1
)
curl.exe -s -i http://localhost:5000/
echo.
echo [OK] Backend verification passed (HTTP !BACKEND_CODE!).
echo.

echo --- Verifying Frontend (port 3000) ---
for /f %%A in ('curl.exe -s -o nul -w "%%{http_code}" --max-time 10 http://localhost:3000/') do set "FRONTEND_CODE=%%A"
if not "!FRONTEND_CODE!"=="200" (
    echo [ERROR] Frontend health check failed with HTTP status: !FRONTEND_CODE!
    exit /b 1
)
curl.exe -s -i http://localhost:3000/
echo.
echo [OK] Frontend verification passed (HTTP !FRONTEND_CODE!).
echo.

echo --- Verifying Nginx API Proxy (port 3000) ---
for /f %%A in ('curl.exe -s -o nul -w "%%{http_code}" --max-time 10 http://localhost:3000/api/categories') do set "PROXY_CODE=%%A"
if not "!PROXY_CODE!"=="200" (
    echo [ERROR] Nginx API proxy check failed with HTTP status: !PROXY_CODE!
    exit /b 1
)
curl.exe -s -i http://localhost:3000/api/categories
echo.
echo [OK] Nginx API proxy verification passed (HTTP !PROXY_CODE!).
echo.

echo =================================================================
echo   SUCCESS: Deployment completed and all services verified!
echo   - Frontend: http://localhost:3000
echo   - Backend:  http://localhost:5000
echo   - Proxy:    http://localhost:3000/api
echo =================================================================
exit /b 0
