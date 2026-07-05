from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
import traceback

from lib.akshare_client import _require_token, fetch_search


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            _require_token(self.headers)
            qs = parse_qs(urlparse(self.path).query)
            market = (qs.get("market") or [""])[0]
            q = (qs.get("q") or [""])[0]
            if not market or not q:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"message": "market and q required"}).encode())
                return
            body = fetch_search(market, q)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(body).encode())
        except PermissionError:
            self.send_response(401)
            self.end_headers()
            self.wfile.write(json.dumps({"message": "unauthorized"}).encode())
        except LookupError as e:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(json.dumps({"message": str(e)}).encode())
        except (ConnectionError, TimeoutError, OSError):
            traceback.print_exc()  # server-side log only
            self.send_response(503)
            self.send_header("Retry-After", "60")
            self.end_headers()
            self.wfile.write(json.dumps({"message": "upstream unavailable, retry later"}).encode())
        except Exception:
            traceback.print_exc()  # server-side log only (Vercel function logs)
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"message": "internal error"}).encode())
