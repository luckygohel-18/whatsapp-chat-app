@echo off
title WhatsApp Chat App
echo ===================================================
echo   Starting WhatsApp Chat App for Phone and Desktop
echo ===================================================
echo.
cd /d "%~dp0"
if exist venv\Scripts\python.exe (
    venv\Scripts\python.exe server.py
) else (
    py server.py
)
pause
