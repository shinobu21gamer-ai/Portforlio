@echo off
echo Starting MiniMart POS System...
echo.

echo [0/4] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
timeout /t 1 /nobreak >nul

echo [1/4] Starting Backend...
start "Backend" cmd /k "cd /d %~dp0 && node src/server.js"

echo [2/4] Waiting for backend...
timeout /t 3 /nobreak >nul

echo [3/4] Starting Frontends...
start "POS Frontend (iframe)" cmd /k "cd /d %~dp0frontend && npx vite --port 5173"
start "HRMS Frontend" cmd /k "cd /d %~dp0frontend-hrms && npx vite --port 3001"

echo [4/4] Waiting for servers to start...
timeout /t 6 /nobreak >nul

echo Opening HRMS (POS is inside HRMS)...
start chrome http://localhost:3001

echo.
echo ============================================
echo   MiniMart POS + HRMS is running!
echo   Backend: http://localhost:5000
echo   HRMS + POS: http://localhost:3001
echo   POS (iframe): http://localhost:5173
echo ============================================
echo.
pause