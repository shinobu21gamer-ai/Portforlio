@echo off
title MiniMart POS+HRMS - Single Port (5000)

echo Starting MiniMart POS + HRMS on single port 5000...
echo.

echo Starting API + HRMS (with embedded POS) on http://localhost:5000
start "MiniMart" cmd /k "cd /d %~dp0 && node src/server.js"

echo.
echo Waiting for server to start...
timeout /t 10 >nul

echo Opening HRMS (with embedded POS) in Chrome...
start chrome http://localhost:5000/hrms/

echo.
echo All running on single port 5000!
echo HRMS (with embedded POS): http://localhost:5000/hrms/
echo API:  http://localhost:5000/api/v1/
echo.
pause