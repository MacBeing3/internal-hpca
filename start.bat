@echo off
REM Double-click this to run the app on http://localhost:5500
REM (Google OAuth rejects file://, so we must serve over http://localhost.)
REM On launch it checks GitHub for updates (safe fast-forward only), then
REM starts a local server that auto-shuts down ~12s after the last tab closes.
cd /d "%~dp0"

REM ── Update check ────────────────────────────────────────────────────────────
REM Skipped when relaunched after an update, or when git isn't installed.
REM "Safe fast-forward": updates only if it can be done without touching your
REM local edits (e.g. auth.js). If local changes would conflict, it skips and
REM keeps your version untouched.
if /i "%~1"=="noupdate" goto launch
where git >nul 2>nul || goto launch

echo Checking for updates...
git fetch --quiet origin main 2>nul
if errorlevel 1 (
  echo Could not reach GitHub. Starting current version.
  goto launch
)

set "BEHIND="
for /f %%c in ('git rev-list --count HEAD..origin/main 2^>nul') do set "BEHIND=%%c"
if not defined BEHIND goto launch
if "%BEHIND%"=="0" (
  echo Already up to date.
  goto launch
)

echo %BEHIND% update^(s^) found. Applying...
git merge --ff-only origin/main >nul 2>nul
if errorlevel 1 (
  echo Update skipped: local changes prevent a safe fast-forward. Keeping your version.
  goto launch
)

REM start.bat itself may have just changed on disk; relaunch a fresh copy so we
REM don't run a half-rewritten script, and stop this (now stale) instance.
echo Updated to the latest version. Relaunching...
start "" "%~f0" noupdate
exit

REM ── Start the server ────────────────────────────────────────────────────────
:launch

REM Preferred: the Python heartbeat server (serve.py opens the browser itself).
REM Launch with the windowless interpreter (pythonw/pyw) detached, then close
REM this launcher immediately, so NO console window stays open. serve.py keeps
REM running in the background and auto-exits when the last tab is closed.
where pythonw >nul 2>nul && (start "" pythonw serve.py & exit)
where pyw     >nul 2>nul && (start "" pyw serve.py & exit)
REM Fallback if only the console interpreter exists: run minimized, then exit.
where py      >nul 2>nul && (start "" /min py serve.py & exit)
where python  >nul 2>nul && (start "" /min python serve.py & exit)

REM Fallback: Node. No auto-shutdown, so close this window when you're done.
where npx >nul 2>nul && (
  start "" http://localhost:5500
  npx --yes serve -l 5500
  goto :eof
)

echo Could not find Python or Node. Install one of them, or use VS Code Live Server.
pause
