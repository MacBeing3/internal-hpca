#!/usr/bin/env python3
"""Local dev server for internal-hpca.

Serves the folder over http://localhost:5500 (Google OAuth rejects file://),
and auto-shuts down when no browser tab is open. The page pings /__alive every
few seconds; if pings stop for HEARTBEAT_TIMEOUT seconds (last tab closed), the
server exits on its own. No background process is left running.
"""
import os
import sys
import time
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 5500
HEARTBEAT_TIMEOUT = 12  # seconds with no ping before shutdown

ROOT = os.path.dirname(os.path.abspath(__file__))
_last_seen = time.time()  # grace period so the browser can load before first ping
_lock = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path.startswith("/__alive"):
            global _last_seen
            with _lock:
                _last_seen = time.time()
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        super().do_GET()

    def log_message(self, *args):
        pass  # keep the console quiet


def watchdog(server):
    while True:
        time.sleep(3)
        with _lock:
            idle = time.time() - _last_seen
        if idle > HEARTBEAT_TIMEOUT:
            print("No active tabs — shutting down.")
            server.shutdown()
            return


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=watchdog, args=(server,), daemon=True).start()
    url = f"http://localhost:{PORT}"
    print(f"Serving {ROOT} at {url}  (auto-stops when the site is closed)")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    sys.exit(main())
