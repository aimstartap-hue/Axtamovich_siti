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

rem --- Google Chrome ni topish ---
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

echo Yangi server ishga tushmoqda...
rem --- Brauzerni ochish (Chrome bo'lsa Chrome, aks holda standart) ---
if exist "%CHROME%" (
  start "" "%CHROME%" "http://localhost:8000"
) else (
  start "" "http://localhost:8000"
)

python server.py
pause
