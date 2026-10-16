#!/usr/bin/env python3
"""Self-hosted Kalender (Python 3.10+ stdlib). Only expose behind HTTPS Nginx."""
import json, mimetypes, os, sqlite3, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT=Path(__file__).resolve().parent
DATA=Path(os.getenv("KALENDER_DATA_DIR", str(ROOT/".private-data"))).resolve()
DB=DATA/"kalender.sqlite3"
ORIGIN=os.getenv("KALENDER_ORIGIN","https://kalender.bytevo.de").rstrip("/")
HOST=os.getenv("KALENDER_HOST","127.0.0.1")
PORT=int(os.getenv("KALENDER_PORT","3102"))
KEYS={"termine":list,"kunden":list,"einstellungen":dict,"events":list,"sperrzeiten":list}
EMPTY={"termine":[],"kunden":[],"einstellungen":{},"events":[],"sperrzeiten":[]}
FILES=set("index.html woche.html jahr.html tag.html kunden.html events.html einstellungen.html stats.html loader.html app.js events.js login.js webmeldungen.js style.css login.css manifest.json sw.js favicon.ico favicon-32.png apple-touch-icon.png apple-touch-icon-1.png icon.png icon-192.png icon-single.png 1774360504505.png".split())
PUBLIC=set("index.html login.js login.css manifest.json sw.js favicon.ico favicon-32.png apple-touch-icon.png apple-touch-icon-1.png icon.png icon-192.png icon-single.png".split())

def dbopen():
    conn=sqlite3.connect(DB,timeout=15,isolation_level=None)
    conn.execute("PRAGMA busy_timeout=15000")
    return conn

def initdb():
    DATA.mkdir(parents=True,exist_ok=True,mode=0o700)
    os.chmod(DATA,0o700)
    with dbopen() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, content TEXT NOT NULL)")
        db.execute("INSERT OR IGNORE INTO snapshot VALUES (1,0,?)",(json.dumps(EMPTY),))

def safe(value,depth=0,key=""):
    """Conservative validation for legacy pages that still use HTML templates."""
    if depth>32:return False
    key=key.lower()
    if isinstance(value,str):
        if len(value)>100000 or any(c in value for c in ("<",">","\x00")):return False
        if key in ("id","kunde_id","event_id","termin_id"):
            return value.isascii() and value.isdigit() and len(value)<=24
        if key in ("bild1","bild2","profilLink".lower(),"profillink","link","farbe","color") or key.endswith("_farbe"):
            if any(c in value for c in ('"', "'", "\u0060", "(", ")", "\\", "\r", "\n", " ")):return False
        return True
    if isinstance(value,list):
        return len(value)<=100000 and all(safe(v,depth+1,key) for v in value)
    if isinstance(value,dict):
        return len(value)<=100000 and all(isinstance(k,str) and len(k)<=200 and safe(v,depth+1,k) for k,v in value.items())
    if key in ("id","kunde_id","event_id","termin_id"):
        return type(value) is int and 0<=value<=10**24
    return value is None or isinstance(value,(int,float,bool))

class Handler(BaseHTTPRequestHandler):
    server_version="Kalender/1.0"
    sys_version=""
    def log_message(self,fmt,*args):
        sys.stderr.write("%s %s\n"%(self.log_date_time_string(),fmt%args))
    def headers_out(self,status,kind,size,extra=None):
        self.send_response(status)
        for k,v in {
            "Content-Type":kind,"Content-Length":str(size),"Cache-Control":"no-store, private, max-age=0",
            "X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer",
            "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
            "Content-Security-Policy":"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
        }.items():self.send_header(k,v)
        for k,v in (extra or {}).items():self.send_header(k,v)
        self.end_headers()
    def json_out(self,status,value,extra=None):
        encoded=json.dumps(value,ensure_ascii=False,allow_nan=False).encode()
        self.headers_out(status,"application/json; charset=utf-8",len(encoded),extra)
        self.wfile.write(encoded)
    def read_body(self):
        try:
            n=int(self.headers.get("Content-Length","-1"))
            if n<0 or n>10*1024*1024:return None
            return json.loads(self.rfile.read(n))
        except (ValueError,UnicodeDecodeError):return None
    def origin_ok(self):
        return self.headers.get("Origin")==ORIGIN and self.headers.get("Sec-Fetch-Site","") not in ("cross-site","same-site")
    def verified(self):
        # Only the dedicated Nginx mTLS vhost sets this header.
        # This HTTP service MUST stay on 127.0.0.1 and never be exposed directly.
        return self.headers.get("X-Kalender-Verified","") == "SUCCESS"
    def do_GET(self):
        path=unquote(urlsplit(self.path).path)
        if path=="/health":return self.json_out(200,{"ok":True})
        if path=="/api/session":return self.json_out(200,{"authenticated":self.verified()})
        if path.startswith("/api/"):
            if not self.verified():return self.json_out(403,{"error":"Dieses Gerät ist nicht freigeschaltet"})
            if path in ("/api/data","/api/export"):
                with dbopen() as db:version,content=db.execute("SELECT version,content FROM snapshot WHERE id=1").fetchone()
                extra={"Content-Disposition":'attachment; filename="kalender-backup.json"'} if path=="/api/export" else None
                return self.json_out(200,{"version":version,"data":json.loads(content)},extra)
            return self.json_out(404,{"error":"Nicht gefunden"})
        if path=="/":path="/index.html"
        name=path.lstrip("/")
        if name not in FILES or "/" in name or "\\" in name:return self.json_out(404,{"error":"Nicht gefunden"})
        if name not in PUBLIC and not self.verified():
            self.send_response(302)
            self.send_header("Location","/index.html")
            self.send_header("Cache-Control","no-store")
            self.end_headers()
            return
        raw=(ROOT/name).read_bytes()
        kind=mimetypes.guess_type(name)[0] or "application/octet-stream"
        if kind.startswith("text/") or kind in ("application/javascript","application/json"):kind+="; charset=utf-8"
        self.headers_out(200,kind,len(raw))
        self.wfile.write(raw)
    def do_POST(self):
        if not self.origin_ok():return self.json_out(403,{"error":"Ungueltiger Seitenursprung"})
        body=self.read_body()
        if not isinstance(body,dict):return self.json_out(400,{"error":"Ungueltige Anfrage"})
        path=urlsplit(self.path).path
        if not self.verified():return self.json_out(403,{"error":"Dieses Gerät ist nicht freigeschaltet"})
        if path=="/api/data":
            version,content=body.get("version"),body.get("data")
            if type(version)!=int or version<0 or not isinstance(content,dict) or any(not isinstance(content.get(k),t) for k,t in KEYS.items()):
                return self.json_out(400,{"error":"Ungueltiges Datenformat"})
            if not safe(content):return self.json_out(400,{"error":"HTML- oder Steuerzeichen in gespeicherten Daten nicht erlaubt"})
            payload=json.dumps({k:content[k] for k in KEYS},ensure_ascii=False,allow_nan=False)
            with dbopen() as db:
                db.execute("BEGIN IMMEDIATE")
                cur=db.execute("UPDATE snapshot SET version=version+1,content=? WHERE id=1 AND version=?",(payload,version))
                if cur.rowcount!=1:
                    remote=db.execute("SELECT version FROM snapshot WHERE id=1").fetchone()[0]
                    db.rollback()
                    return self.json_out(409,{"error":"Aenderungskonflikt","serverVersion":remote})
                db.commit()
            return self.json_out(200,{"ok":True,"version":version+1})
        return self.json_out(404,{"error":"Nicht gefunden"})

def main():
    initdb()
    app=ThreadingHTTPServer((HOST,PORT),Handler)
    print("Kalender (mTLS) nur auf http://%s:%d"%(HOST,PORT),flush=True)
    app.serve_forever()

if __name__=="__main__":main()
