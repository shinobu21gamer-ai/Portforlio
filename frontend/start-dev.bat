@echo off
echo ============================================
echo   MiniMart POS - Frontend Dev Server
echo ============================================
echo.
echo Open http://localhost:5173 in your browser
echo.
cd /d "%~dp0frontend"
call npm run dev
pause
