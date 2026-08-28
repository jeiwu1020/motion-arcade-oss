@echo off
setlocal
title Motion Arcade - Local Pose Sensor Lab

cd /d "%~dp0"

echo ========================================
echo Motion Arcade - Local Pose Sensor Lab
echo ========================================
echo.

if not exist "package.json" (
  echo [ERROR] package.json was not found.
  echo Please place this file in the motion-arcade repository root.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found in PATH.
  echo Please install Node.js and reopen this launcher.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found in PATH.
  echo Please reinstall Node.js with npm enabled.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo node_modules not found. Installing dependencies with npm ci...
  echo.
  call npm ci
  if errorlevel 1 (
    echo.
    echo [ERROR] npm ci failed.
    pause
    exit /b 1
  )
)

echo Starting Vite development server on http://localhost:5173
echo Pose Sensor Lab will open automatically.
echo.
echo Close the separate dev-server window when testing is finished.
echo.

start "Motion Arcade Dev Server" cmd /k "cd /d ""%~dp0"" && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"

timeout /t 3 /nobreak >nul
start "" "http://localhost:5173/#pose-sensor-lab"

endlocal
