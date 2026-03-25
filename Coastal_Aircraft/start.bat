@echo off
title Coastal Aircraft — 3D Viewer
echo.
echo  ╔══════════════════════════════════════╗
echo  ║   Coastal Aircraft — 3D Viewer       ║
echo  ╚══════════════════════════════════════╝
echo.

:: Check for node_modules
if not exist "node_modules" (
    echo  [1/2] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo  ERROR: npm install failed. Make sure Node.js is installed.
        pause
        exit /b 1
    )
    echo.
) else (
    echo  [1/2] Dependencies already installed — skipping.
)

echo  [2/2] Starting dev server...
echo.
echo  The viewer will open automatically at http://localhost:5173
echo  Press Ctrl+C to stop the server.
echo.

npm run dev
