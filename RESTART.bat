@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   AXO-OPEN group - TO'LIQ QAYTA ISHGA TUSHIRISH
echo ============================================
echo.
echo Eski server to'xtatilmoqda...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
timeout /t 1 >nul
echo Yangi server ishga tushmoqda...
start "" http://localhost:8000
python server.py
pause
