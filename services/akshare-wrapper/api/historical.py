from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from datetime import datetime
import json
import sys

sys.path.insert(0, "api")

from _shared.akshare_client import _require_token, fetch_quote  # noqa: E402


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
            # Stage 3: return latest only; extend with date window when Block C needs it
            _ = qs.get("from")
            _ = qs.get("to")
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
        except Exception as e:
            self.send_response(503)
            self.end_headers()
            self.wfile.write(json.dumps({"message": str(e)}).encode())
