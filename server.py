#!/usr/bin/env python3
"""Private Kalender backend. Server-side PIN, optional device certificate gate."""
import getpass
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import time
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
from schedule_validation import introduced_conflicts

ROOT = Path(__file__).resolve().parent
DATA = Path(os.getenv("KALENDER_DATA_DIR", str(ROOT / ".private-data"))).resolve()
DB = DATA / "kalender.sqlite3"
ORIGIN = os.getenv("KALENDER_ORIGIN", "https://kalender.bytevo.de").rstrip("/")
HOST = "127.0.0.1"  # Do not expose local trusted proxy headers on public interfaces
PORT = int(os.getenv("KALENDER_PORT", "3102"))
REQUIRE_DEVICE_CERT = os.getenv("KALENDER_REQUIRE_DEVICE_CERT", "1") == "1"
FIELDS = {"termine": list, "kunden": list, "einstellungen": dict, "events": list, "sperrzeiten": list}
EMPTY = {"termine": [], "kunden": [], "einstellungen": {}, "events": [], "sperrzeiten": []}
FILES = set("index.html woche.html jahr.html tag.html kunden.html events.html einstellungen.html stats.html loader.html app.js events.js login.js server-sync.js webmeldungen.js style.css login.css manifest.json sw.js favicon.ico favicon-32.png apple-touch-icon.png apple-touch-icon-1.png icon.png icon-192.png icon-single.png 1774360504505.png".split())
PUBLIC = set("index.html login.js login.css manifest.json sw.js favicon.ico favicon-32.png apple-touch-icon.png apple-touch-icon-1.png icon.png icon-192.png icon-single.png".split())
COOKIE = "kalender_session"
SESSION_AGE = 24 * 60 * 60
ROUNDS = 600000

def dbopen():
    db = sqlite3.connect(DB, timeout=15, isolation_level=None)
    db.execute("PRAGMA busy_timeout=15000")
    return db

def initdb():
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(DATA, 0o700)
    with dbopen() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, content TEXT NOT NULL)")
        db.execute("INSERT OR IGNORE INTO snapshot VALUES (1,0,?)", (json.dumps(EMPTY),))
        db.execute("CREATE TABLE IF NOT EXISTS pin_auth (id INTEGER PRIMARY KEY CHECK(id=1), pin_hash TEXT NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expiry INTEGER NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS pin_attempts (ip TEXT PRIMARY KEY, attempts INTEGER NOT NULL, first_try INTEGER NOT NULL)")

def make_pin_hash(pin):
    salt = secrets.token_bytes(16)
    value = hashlib.pbkdf2_hmac("sha256", pin.encode("ascii"), salt, ROUNDS)
    return "pbkdf2-sha256:%d:%s:%s" % (ROUNDS, salt.hex(), value.hex())

def check_pin(pin, encoded):
    try:
        algorithm, rounds, salt, expected = encoded.split(":")
        cost = int(rounds)
        if algorithm != "pbkdf2-sha256" or not 100000 <= cost <= 2000000:
            return False
        actual = hashlib.pbkdf2_hmac("sha256", pin.encode("ascii"), bytes.fromhex(salt), cost)
        return hmac.compare_digest(actual, bytes.fromhex(expected))
    except (TypeError, ValueError):
        return False

def configure_pin():
    initdb()
    with dbopen() as db:
        if db.execute("SELECT 1 FROM pin_auth WHERE id=1").fetchone():
            raise SystemExit("PIN bereits eingerichtet. Zum Ändern im Kalender anmelden oder 'reset-pin' verwenden.")
    return change_pin()

def change_pin():
    new = getpass.getpass("Neue 4-stellige PIN (Eingabe unsichtbar): ")
    repeat = getpass.getpass("PIN wiederholen: ")
    if not re.fullmatch(r"[0-9]{4}", new or "") or new != repeat:
        raise SystemExit("Abbruch: PIN muss genau vier Ziffern enthalten und übereinstimmen.")
    if new in {"0000", "1111", "1234", "4321", "9999"}:
        raise SystemExit("Abbruch: Bitte eine weniger offensichtliche PIN wählen.")
    value = make_pin_hash(new)
    with dbopen() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("INSERT OR REPLACE INTO pin_auth VALUES (1, ?)", (value,))
        db.execute("DELETE FROM sessions")
        db.execute("DELETE FROM pin_attempts")
        db.commit()
    print("PIN gespeichert (als sicherer Hash). Alle bisherigen Sitzungen abgemeldet.")

def safe(value, depth=0, key=""):
    if depth > 32: return False
    key = key.lower()
    if isinstance(value, str):
        if len(value) > 100000 or any(c in value for c in ("<", ">", "\x00")): return False
        if key in ("id", "kunde_id", "event_id", "termin_id"):
            return value.isascii() and value.isdigit() and len(value) <= 24
        if key in ("bild1", "bild2", "profillink", "link", "farbe", "color") or key.endswith("_farbe"):
            if any(c in value for c in ('"', "'", "\u0060", "(", ")", "\\", "\r", "\n", " ")): return False
        return True
    if isinstance(value, list): return len(value) <= 100000 and all(safe(v, depth+1, key) for v in value)
    if isinstance(value, dict): return len(value) <= 100000 and all(isinstance(k, str) and len(k) <= 200 and safe(v, depth+1, k) for k,v in value.items())
    if key in ("id", "kunde_id", "event_id", "termin_id"): return type(value) is int and 0 <= value <= 10**24
    return value is None or isinstance(value, (int, float, bool))

class Handler(BaseHTTPRequestHandler):
    server_version = "Kalender/2.0"
    sys_version = ""

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))

    def common(self, code, kind, size, extra=None):
        self.send_response(code)
        headers = {
            "Content-Type": kind, "Content-Length": str(size),
            "Cache-Control": "private, no-store, max-age=0",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "no-referrer",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
        }
        headers.update(extra or {})
        for key, value in headers.items(): self.send_header(key, value)
        self.end_headers()

    def output(self, code, value, extra=None):
        data = json.dumps(value, ensure_ascii=False, allow_nan=False).encode()
        self.common(code, "application/json; charset=utf-8", len(data), extra)
        self.wfile.write(data)

    def read_json(self):
        try:
            size = int(self.headers.get("Content-Length", "-1"))
            if size < 0 or size > 10 * 1024 * 1024: return None
            return json.loads(self.rfile.read(size))
        except (ValueError, UnicodeDecodeError): return None

    def origin_ok(self):
        return self.headers.get("Origin") == ORIGIN and self.headers.get("Sec-Fetch-Site", "") not in ("cross-site", "same-site")

    def device_ok(self):
        # Localhost-only backend: only dedicated Nginx vhost supplies this header.
        return (not REQUIRE_DEVICE_CERT) or self.headers.get("X-Kalender-Verified", "") == "SUCCESS"

    def cookie(self, token=None):
        value = token or ""
        if token:
            return "%s=%s; Path=/; Max-Age=%d; Secure; HttpOnly; SameSite=Strict" % (COOKIE, value, SESSION_AGE)
        return "%s=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict" % COOKIE

    def session_token(self):
        jar = cookies.SimpleCookie()
        try:
            jar.load(self.headers.get("Cookie", ""))
            token = jar[COOKIE].value
            if len(token) < 32: return None
        except (KeyError, cookies.CookieError): return None
        digest = hashlib.sha256(token.encode()).hexdigest()
        with dbopen() as db:
            row = db.execute("SELECT expiry FROM sessions WHERE token_hash=?", (digest,)).fetchone()
        return digest if row and row[0] > int(time.time()) else None

    def authorized(self):
        return self.device_ok() and bool(self.session_token())

    def redirect_login(self):
        self.send_response(302)
        self.send_header("Location", "/index.html")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path == "/health":
            # Health endpoint only reachable through local socket or mTLS.
            return self.output(200, {"ok": True})
        if not self.device_ok():
            return self.output(403, {"error": "Gerät nicht freigeschaltet"})
        if path == "/api/session":
            with dbopen() as db:
                configured = bool(db.execute("SELECT 1 FROM pin_auth WHERE id=1").fetchone())
            return self.output(200, {"authenticated": self.authorized(), "pinConfigured": configured})
        if path.startswith("/api/"):
            if not self.authorized(): return self.output(401, {"error": "PIN-Anmeldung erforderlich"})
            if path in ("/api/data", "/api/export"):
                with dbopen() as db:
                    version, payload = db.execute("SELECT version, content FROM snapshot WHERE id=1").fetchone()
                extra = {"Content-Disposition": 'attachment; filename="kalender-backup.json"'} if path == "/api/export" else None
                return self.output(200, {"version": version, "data": json.loads(payload)}, extra)
            return self.output(404, {"error": "Nicht gefunden"})
        if path == "/": path = "/index.html"
        name = path.lstrip("/")
        if name not in FILES or "/" in name or "\\" in name:
            return self.output(404, {"error": "Nicht gefunden"})
        if name not in PUBLIC and not self.authorized():
            return self.redirect_login()
        raw = (ROOT / name).read_bytes()
        kind = mimetypes.guess_type(name)[0] or "application/octet-stream"
        if kind.startswith("text/") or kind in ("application/javascript", "application/json"): kind += "; charset=utf-8"
        self.common(200, kind, len(raw))
        self.wfile.write(raw)

    def do_POST(self):
        if not self.device_ok(): return self.output(403, {"error": "Gerät nicht freigeschaltet"})
        if not self.origin_ok(): return self.output(403, {"error": "Seitenursprung nicht erlaubt"})
        path = urlsplit(self.path).path
        body = self.read_json()
        if not isinstance(body, dict): return self.output(400, {"error": "Ungültige Eingabe"})
        if path == "/api/login":
            pin = body.get("pin")
            if not isinstance(pin, str) or not re.fullmatch(r"[0-9]{4}", pin):
                return self.output(400, {"error": "Vierstellige PIN eingeben"})
            ip = self.headers.get("X-Real-IP", self.client_address[0])[:64]
            now = int(time.time())
            with dbopen() as db:
                db.execute("BEGIN IMMEDIATE")
                row = db.execute("SELECT attempts,first_try FROM pin_attempts WHERE ip=?", (ip,)).fetchone()
                if row and now - row[1] >= 900:
                    db.execute("DELETE FROM pin_attempts WHERE ip=?", (ip,))
                    row = None
                if row and row[0] >= 5:
                    db.commit()
                    return self.output(429, {"error": "Zu viele Versuche. 15 Minuten warten."})
                stored = db.execute("SELECT pin_hash FROM pin_auth WHERE id=1").fetchone()
                if not stored:
                    db.commit()
                    return self.output(503, {"error": "PIN noch nicht auf dem Server eingerichtet"})
                valid = check_pin(pin, stored[0])
                if not valid:
                    if row:
                        db.execute("UPDATE pin_attempts SET attempts=attempts+1 WHERE ip=?", (ip,))
                    else:
                        db.execute("INSERT INTO pin_attempts VALUES (?,1,?)", (ip, now))
                    db.commit()
                    return self.output(401, {"error": "PIN falsch"})
                db.execute("DELETE FROM pin_attempts WHERE ip=?", (ip,))
                token = secrets.token_urlsafe(36)
                digest = hashlib.sha256(token.encode()).hexdigest()
                db.execute("DELETE FROM sessions WHERE expiry < ?", (now,))
                db.execute("INSERT INTO sessions VALUES (?,?)", (digest, now + SESSION_AGE))
                db.commit()
            return self.output(200, {"ok": True}, {"Set-Cookie": self.cookie(token)})
        session = self.session_token()
        if not session: return self.output(401, {"error": "Bitte mit PIN anmelden"})
        if path == "/api/logout":
            with dbopen() as db: db.execute("DELETE FROM sessions WHERE token_hash=?", (session,))
            return self.output(200, {"ok": True}, {"Set-Cookie": self.cookie()})
        if path == "/api/change-pin":
            current, new = body.get("current"), body.get("new")
            if not isinstance(current, str) or not isinstance(new, str) or not re.fullmatch(r"[0-9]{4}", new):
                return self.output(400, {"error": "Vierstellige PIN eingeben"})
            with dbopen() as db:
                old = db.execute("SELECT pin_hash FROM pin_auth WHERE id=1").fetchone()
            if not old or not check_pin(current, old[0]): return self.output(403, {"error": "Alte PIN falsch"})
            if new in ("0000", "1111", "1234", "4321", "9999"):
                return self.output(400, {"error": "Bitte weniger offensichtliche PIN wählen"})
            with dbopen() as db:
                db.execute("BEGIN IMMEDIATE")
                db.execute("UPDATE pin_auth SET pin_hash=? WHERE id=1", (make_pin_hash(new),))
                db.execute("DELETE FROM sessions")
                db.commit()
            return self.output(200, {"ok": True}, {"Set-Cookie": self.cookie()})
        if path == "/api/data":
            version, content = body.get("version"), body.get("data")
            if type(version) is not int or version < 0 or not isinstance(content, dict) or any(not isinstance(content.get(k), cls) for k, cls in FIELDS.items()):
                return self.output(400, {"error": "Ungültiges Datenformat"})
            if not safe(content): return self.output(400, {"error": "Unzulässige HTML-/Steuerzeichen in den Daten"})
            try: payload = json.dumps({k: content[k] for k in FIELDS}, ensure_ascii=False, allow_nan=False)
            except ValueError: return self.output(400, {"error": "Ungültige Zahlen"})
            with dbopen() as db:
                db.execute("BEGIN IMMEDIATE")
                current_version, current_json = db.execute("SELECT version,content FROM snapshot WHERE id=1").fetchone()
                if current_version != version:
                    db.rollback()
                    return self.output(409, {"error": "Änderungskonflikt", "serverVersion": current_version})
                # Also validate server-side: an outdated tab or a second device
                # must not introduce overlaps across bookings, events and blocks.
                if introduced_conflicts(json.loads(current_json), content):
                    db.rollback()
                    return self.output(422, {"error": "Doppelbuchung: Termin, Event oder Sperrzeit überschneiden sich. Nicht gespeichert."})
                db.execute("UPDATE snapshot SET version=version+1,content=? WHERE id=1", (payload,))
                db.commit()
            return self.output(200, {"ok": True, "version": version+1})
        return self.output(404, {"error": "Nicht gefunden"})

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd == "set-pin": return configure_pin()
    if cmd == "reset-pin":
        initdb()
        with dbopen() as db:
            if not db.execute("SELECT 1 FROM pin_auth WHERE id=1").fetchone():
                raise SystemExit("Noch keine PIN vorhanden; set-pin verwenden.")
        return change_pin()
    if cmd != "serve": raise SystemExit("Unbekannter Befehl")
    initdb()
    app = ThreadingHTTPServer((HOST, PORT), Handler)
    print("Kalender API auf http://%s:%d (hinter mTLS)" % (HOST, PORT), flush=True)
    app.serve_forever()

if __name__ == "__main__": main()
