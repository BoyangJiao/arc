from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
import traceback

from lib.akshare_client import _require_token, fetch_quote, fetch_quotes_window


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            _require_token(self.headers)
            qs = parse_qs(urlparse(self.path).query)
            market = (qs.get("market") or [""])[0]
            symbol = (qs.get("symbol") or [""])[0]
            if not market or not symbol:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"message": "market and symbol required"}).encode())
                return
            # Block A P1-1: implement real date window. Without from/to, return latest 1 row (compat).
            from_iso = (qs.get("from") or [""])[0]
            to_iso = (qs.get("to") or [""])[0]
            if from_iso and to_iso:
                body = fetch_quotes_window(market, symbol, from_iso, to_iso)
            else:
                body = [fetch_quote(market, symbol)]
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
            # Transient upstream — signal retry (Block A P1-2).
            traceback.print_exc()  # server-side log only
            self.send_response(503)
            self.send_header("Retry-After", "60")
            self.end_headers()
            self.wfile.write(json.dumps({"message": "upstream unavailable, retry later"}).encode())
        except Exception:
            # Bug / data shape change — no retry hint; client → NetworkError → bubble (Sentry-ready).
            traceback.print_exc()  # server-side log only (Vercel function logs)
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"message": "internal error"}).encode())
