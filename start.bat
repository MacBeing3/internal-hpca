@echo off
REM ============================================================================
REM  Inventaire des Medicaments - launcher
REM
REM  Double-click to run the app. It checks GitHub for the latest version,
REM  updates this folder, then opens the app in your browser. The little window
REM  closes itself once the app has started; the app's server runs in the
REM  background and stops on its own a few seconds after you close the browser.
REM
REM  Works with NO setup required:
REM    * Updates use Git if installed, otherwise plain Windows (PowerShell).
REM    * The app runs on Python if installed, otherwise plain Windows.
REM  (Google sign-in needs a real web address, so we serve http://127.0.0.1:5500
REM   instead of opening the file directly.)
REM ============================================================================
setlocal EnableExtensions

REM --- Trampoline: run from a temp copy so self-updating can't corrupt this run.
if /i "%~1"=="__run" goto run
set "APPDIR=%~dp0"
if "%APPDIR:~-1%"=="\" set "APPDIR=%APPDIR:~0,-1%"
set "TMPBAT=%TEMP%\hpca_launcher_%RANDOM%%RANDOM%.bat"
copy /y "%~f0" "%TMPBAT%" >nul
"%TMPBAT%" __run "%APPDIR%"
exit /b

:run
set "APPDIR=%~2"
cd /d "%APPDIR%"
title Inventaire des Medicaments

echo Checking for updates...

REM --- Update: prefer Git fast-forward (keeps your local edits), else zip sync.
set "USED_GIT="
where git >nul 2>nul && if exist ".git\" (
    set "USED_GIT=1"
    git fetch --quiet origin main 2>nul && git merge --ff-only origin/main >nul 2>nul
)
if not defined USED_GIT (
    where powershell >nul 2>nul && powershell -NoProfile -ExecutionPolicy Bypass -File "%APPDIR%\update.ps1"
)

echo Starting the app...

REM --- Start the server (all options auto-shut down when the browser closes).
REM 1) Python, windowless.
where pythonw >nul 2>nul && (start "" pythonw "%APPDIR%\serve.py" & goto bye)
where pyw     >nul 2>nul && (start "" pyw "%APPDIR%\serve.py" & goto bye)
REM 2) Plain Windows PowerShell server (no Python needed), hidden.
where powershell >nul 2>nul && (
    start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%APPDIR%\serve.ps1"
    goto bye
)
REM 3) Console Python, minimized.
where py     >nul 2>nul && (start "" /min py "%APPDIR%\serve.py" & goto bye)
where python >nul 2>nul && (start "" /min python "%APPDIR%\serve.py" & goto bye)

echo.
echo Could not start the app automatically.
echo Please install Python from https://www.python.org/downloads/ then try again.
echo.
pause

:bye
REM Delete this temp launcher copy and close the window.
(goto) 2>nul & del "%~f0"
