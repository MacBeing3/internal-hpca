@echo off
REM Double-click this to run the app on http://localhost:5500
REM (Google OAuth rejects file://, so we must serve over http://localhost.)
REM The server auto-shuts down ~12s after the last browser tab is closed.
cd /d "%~dp0"

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
