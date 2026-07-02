@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo AXO-OPEN group ishga tushmoqda...

rem --- Google Chrome ni topish ---
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

rem --- Brauzerni ochish (Chrome bo'lsa Chrome, aks holda standart) ---
if exist "%CHROME%" (
  start "" "%CHROME%" "http://localhost:8000"
) else (
  start "" "http://localhost:8000"
)

python server.py
pause
