@echo off
title Coastal Aircraft Maintenance

:: ─── Self-unblock: strip the Mark-of-the-Web (Zone.Identifier) ───
powershell -NoProfile -Command ^
  "Get-ChildItem -Path '%~dp0..' -Recurse | Unblock-File -ErrorAction SilentlyContinue"
powershell -NoProfile -Command "Unblock-File -Path '%~f0' -ErrorAction SilentlyContinue"

echo.
echo  ╔══════════════════════════════════════╗
echo  ║   Coastal Aircraft Maintenance       ║
echo  ║   Investor Presentation              ║
echo  ╚══════════════════════════════════════╝
echo.

:: ─── Verify Python is installed ──────────────────────────────────
where python >nul 2>nul
if errorlevel 1 (
    echo  ERROR: Python is not installed or not on PATH.
    echo         Download it from https://python.org
    echo.
    pause
    exit /b 1
)

echo  Starting server on http://localhost:8080
echo.

:: Open the browser
start "" "http://localhost:8080"

:: Run the Python server (foreground — keeps the window open)
pushd "%~dp0.."
python server.py
popd
