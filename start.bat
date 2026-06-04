@echo off
:: ─────────────────────────────────────────────
::  BioViewer — Start script (Windows)
:: ─────────────────────────────────────────────

set ROOT=%~dp0
set FRONTEND=%ROOT%frontend
set BACKEND=%ROOT%backend

echo.
echo   ╔══════════════════════════════════╗
echo   ║   🧬  BioViewer - Starting...    ║
echo   ╚══════════════════════════════════╝
echo.

:: Check node_modules
if not exist "%FRONTEND%\node_modules" (
  echo [ERREUR] Dependances manquantes. Lancez d'abord : install.bat
  pause
  exit /b 1
)

:: Start backend if venv exists
if exist "%BACKEND%\.venv\Scripts\activate.bat" (
  echo [Backend] Demarrage Flask sur port 5000...
  start "BioViewer Backend" cmd /c "cd /d %BACKEND% && .venv\Scripts\activate && python app.py"
  timeout /t 2 /nobreak >nul
  echo [Backend] Flask demarre sur http://localhost:5000
) else (
  echo [Backend] Non installe (optionnel - app fonctionne sans lui)
)

echo.
echo [Frontend] Demarrage Vite sur port 5173...
echo.

:: Open browser
timeout /t 3 /nobreak >nul
start http://localhost:5173

:: Start Vite
cd /d "%FRONTEND%"
npm run dev -- --host 0.0.0.0

pause
