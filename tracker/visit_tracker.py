import http.server
import socketserver
import os
import threading
from datetime import datetime, timezone

# ─────────── settings ───────────
HOST     = "127.0.0.1"     # only localhost; nginx will proxy to it (safer)
PORT     = 5055            # NOT 5000 (Rankit). Change if needed.
DATA_DIR = os.path.dirname(os.path.abspath(__file__))
COUNT_FILE = os.path.join(DATA_DIR, "visits_count.txt")
LOG_FILE   = os.path.join(DATA_DIR, "visits_log.txt")

# 1x1 transparent GIF (43 bytes)
PIXEL = bytes([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    0x00, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3B,
])

_lock = threading.Lock()


def _read_count():
    try:
        with open(COUNT_FILE) as f:
            return int((f.read() or "0").strip())
    except (FileNotFoundError, ValueError):
        return 0


def _bump(ip, path):
    """Increment the counter and append a log line. Thread-safe."""
    with _lock:
        n = _read_count() + 1
        # write count atomically-ish (small file, single writer under lock)
        with open(COUNT_FILE, "w") as f:
            f.write(str(n))
        ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with open(LOG_FILE, "a") as f:
            f.write(f"{ts}\t{ip}\t{path}\n")
        return n


class Handler(http.server.BaseHTTPRequestHandler):
    # silence the default noisy console logging
    def log_message(self, *args):
        pass

    def _client_ip(self):
        # honour X-Forwarded-For set by nginx, else the socket peer
        xff = self.headers.get("X-Forwarded-For", "")
        return xff.split(",")[0].strip() if xff else self.client_address[0]

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/track":
            _bump(self._client_ip(), path)
            self.send_response(200)
            self.send_header("Content-Type", "image/gif")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.send_header("Content-Length", str(len(PIXEL)))
            self.end_headers()
            self.wfile.write(PIXEL)
            return

        if path == "/count":
            body = str(_read_count()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_response(404)
        self.end_headers()


class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    # make sure the files exist
    if not os.path.exists(COUNT_FILE):
        with open(COUNT_FILE, "w") as f:
            f.write("0")
    open(LOG_FILE, "a").close()

    print(f"AriaDNA visit tracker on http://{HOST}:{PORT}")
    print(f"  count file: {COUNT_FILE}")
    print(f"  log file:   {LOG_FILE}")
    with ThreadingServer((HOST, PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped.")
