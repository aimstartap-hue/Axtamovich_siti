@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo AXO-OPEN group ishga tushmoqda...
start "" http://localhost:8000
python server.py
pause
