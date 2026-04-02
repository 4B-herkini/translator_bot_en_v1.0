@echo off
chcp 65001 >nul
title TransLit MVP (Port 8000)
echo ======================================
echo   TransLit - AI Business Translation
echo   http://localhost:8000
echo ======================================
echo.
cd /d "%~dp0"
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 5050
pause
