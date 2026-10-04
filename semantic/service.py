"""HTTP front for matcher.similarity(), used by the Harmony server (lib/scorer.ts).

    POST /similarity  {"summary_a": "...", "summary_b": "..."}  ->  {"score": 0.73}
    GET  /health                                                ->  {"ok": true}

Start it with ./run.sh (listens on 127.0.0.1:8008 by default; set PORT to change).
"""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from matcher import similarity


class Handler(BaseHTTPRequestHandler):
  def _reply(self, status: int, body: dict):
    data = json.dumps(body).encode()
    self.send_response(status)
    self.send_header("Content-Type", "application/json")
    self.send_header("Content-Length", str(len(data)))
    self.end_headers()
    self.wfile.write(data)

  def do_GET(self):
    if self.path == "/health":
      self._reply(200, {"ok": True})
    else:
      self._reply(404, {"error": "not found"})

  def do_POST(self):
    if self.path != "/similarity":
      return self._reply(404, {"error": "not found"})
    try:
      length = int(self.headers.get("Content-Length", 0))
      body = json.loads(self.rfile.read(length))
      a, b = body["summary_a"], body["summary_b"]
      if not isinstance(a, str) or not isinstance(b, str) or not a.strip() or not b.strip():
        raise ValueError("summary_a and summary_b must be non-empty strings")
    except (ValueError, KeyError, TypeError) as e:
      return self._reply(400, {"error": f"bad request: {e}"})
    self._reply(200, {"score": similarity(a, b)})

  def log_message(self, fmt, *args):
    print("%s - %s" % (self.address_string(), fmt % args))


if __name__ == "__main__":
  port = int(os.environ.get("PORT", "8008"))
  print(f"similarity service on http://127.0.0.1:{port}")
  ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
