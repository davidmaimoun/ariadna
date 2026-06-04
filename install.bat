@echo off
:: ─────────────────────────────────────────────
::  BioViewer — Install script (Windows)
:: ─────────────────────────────────────────────

set ROOT=%~dp0

echo.
echo   ╔══════════════════════════════════╗
echo   ║   🧬  BioViewer - Install        ║
echo   ╚══════════════════════════════════╝
echo.

:: Check Node
node -v >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Node.js non trouve. Installez-le depuis https://nodejs.org
  pause
  exit /b 1
)
echo [OK] Node.js detecte : 
node -v

:: Install frontend
echo.
echo [1/2] Installation frontend...
cd /d "%ROOT%frontend"
npm install
echo [OK] Frontend pret

:: Install backend (optional)
echo.
echo [2/2] Backend Flask (optionnel)...
python --version >nul 2>&1
if errorlevel 1 (
  echo [SKIP] Python non trouve - backend ignore
) else (
  cd /d "%ROOT%backend"
  if not exist ".venv" (
    python -m venv .venv
  )
  call .venv\Scripts\activate
  pip install -q --upgrade pip
  pip install -q -r requirements.txt
  echo [OK] Backend Flask installe
)

echo.
echo   ╔══════════════════════════════════════╗
echo   ║  Installation terminee !             ║
echo   ║  Lancez l'app avec :  start.bat      ║
echo   ╚══════════════════════════════════════╝
pause
