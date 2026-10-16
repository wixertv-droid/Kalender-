#!/usr/bin/env python3
"""Self-hosted Kalender (Python 3.10+ stdlib). Only expose behind HTTPS Nginx."""
import argparse, getpass, hashlib, hmac, json, mimetypes, os, secrets, sqlite3, sys, threading, time
from http import cookies
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
FILES=set("index.html woche.html jahr.html tag.html kunden.html events.html einstellungen.html stats.html loader.html app.js events.js login.js style.css login.css manifest.json sw.js favicon.ico favicon-32.png apple-touch-icon.png apple-touch-icon-1.png icon.png icon-192.png icon-single.png 1774360504505.png".split())
PUBLIC=set("index.html login.js login.css manifest.json sw.js favicon.ico favicon-32.png apple-touch-icon.png apple-touch-icon-1.png icon.png icon-192.png icon-single.png".split())
LIFETIME=7*86400
ROUNDS=600000
ATTEMPTS={}
LOCK=threading.Lock()

def dbopen():
    conn=sqlite3.connect(DB,timeout=15,isolation_level=None)
    conn.execute("PRAGMA busy_timeout=15000")
    return conn

def initdb():
    DATA.mkdir(parents=True,exist_ok=True,mode=0o700)
    os.chmod(DATA,0o700)
    with dbopen() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY CHECK(id=1), password_hash TEXT NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS sessions (digest TEXT PRIMARY KEY, expires INTEGER NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, content TEXT NOT NULL)")
        db.execute("INSERT OR IGNORE INTO snapshot VALUES (1,0,?)",(json.dumps(EMPTY),))

def digest_password(password):
    salt=secrets.token_bytes(16)
    hashed=hashlib.pbkdf2_hmac("sha256",password.encode(),salt,ROUNDS)
    return "pbkdf2_sha256$%d$%s$%s"%(ROUNDS,salt.hex(),hashed.hex())

def valid_password(password,stored):
    try:
        algo,rounds,salt,expected=stored.split("$")
        if algo!="pbkdf2_sha256" or not 100000<=int(rounds)<=2000000:return False
        actual=hashlib.pbkdf2_hmac("sha256",password.encode(),bytes.fromhex(salt),int(rounds))
        return hmac.compare_digest(actual,bytes.fromhex(expected))
    except (ValueError,TypeError):return False

def provision(reset=False):
    initdb()
    with dbopen() as db:exists=bool(db.execute("SELECT 1 FROM admin WHERE id=1").fetchone())
    if exists and not reset:raise SystemExit("Admin vorhanden; reset-password zum Zuruecksetzen.")
    if reset and not exists:raise SystemExit("Noch kein Admin vorhanden; init-admin verwenden.")
    one=getpass.getpass("Admin-Passwort (mindestens 12 Zeichen): ")
    two=getpass.getpass("Passwort wiederholen: ")
    if one!=two or len(one)<12 or len(one.encode())>1024:raise SystemExit("Passwort ungueltig.")
    value=digest_password(one)
    with dbopen() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("INSERT OR REPLACE INTO admin VALUES(1,?)",(value,))
        db.execute("DELETE FROM sessions")
        db.commit()
    print("Admin eingerichtet, bisherige Sitzungen abgemeldet.")

def safe(value,depth=0):
    if depth>32:return False
    if isinstance(value,str):return len(value)<=100000 and not any(c in value for c in ("<",">","\x00"))
    if isinstance(value,list):return len(value)<=100000 and all(safe(v,depth+1) for v in value)
    if isinstance(value,dict):return len(value)<=100000 and all(isinstance(k,str) and len(k)<=200 and safe(v,depth+1) for k,v in value.items())
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
    def session(self):
        try:
            jar=cookies.SimpleCookie()
            jar.load(self.headers.get("Cookie",""))
            token=jar["kalender_session"].value
            if len(token)<30:return None
        except (KeyError,cookies.CookieError):return None
        digest=hashlib.sha256(token.encode()).hexdigest()
        with dbopen() as db:row=db.execute("SELECT expires FROM sessions WHERE digest=?",(digest,)).fetchone()
        return digest if row and row[0]>time.time() else None
    def cookie(self,token="",expire=False):
        if expire:return "kalender_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict"
        return "kalender_session=%s; Path=/; Max-Age=%d; HttpOnly; Secure; SameSite=Strict"%(token,LIFETIME)
    def do_GET(self):
        path=unquote(urlsplit(self.path).path)
        if path=="/health":return self.json_out(200,{"ok":True})
        if path=="/api/session":return self.json_out(200,{"authenticated":bool(self.session())})
        if path.startswith("/api/"):
            if not self.session():return self.json_out(401,{"error":"Nicht angemeldet"})
            if path in ("/api/data","/api/export"):
                with dbopen() as db:version,content=db.execute("SELECT version,content FROM snapshot WHERE id=1").fetchone()
                extra={"Content-Disposition":'attachment; filename="kalender-backup.json"'} if path=="/api/export" else None
                return self.json_out(200,{"version":version,"data":json.loads(content)},extra)
            return self.json_out(404,{"error":"Nicht gefunden"})
        if path=="/":path="/index.html"
        name=path.lstrip("/")
        if name not in FILES or "/" in name or "\\" in name:return self.json_out(404,{"error":"Nicht gefunden"})
        if name not in PUBLIC and not self.session():
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
        if path=="/api/login":
            ip=self.headers.get("X-Real-IP",self.client_address[0])[:90]
            now=time.time()
            with LOCK:
                ATTEMPTS[ip]=[x for x in ATTEMPTS.get(ip,[]) if now-x<900]
                blocked=len(ATTEMPTS[ip])>=5
            if blocked:return self.json_out(429,{"error":"Zu viele Versuche. Spaeter erneut versuchen."})
            password=body.get("password")
            if not isinstance(password,str) or len(password)>1024:return self.json_out(400,{"error":"Ungueltige Eingabe"})
            with dbopen() as db:row=db.execute("SELECT password_hash FROM admin WHERE id=1").fetchone()
            if not row or not valid_password(password,row[0]):
                with LOCK:ATTEMPTS.setdefault(ip,[]).append(time.time())
                return self.json_out(401,{"error":"Falsches Passwort"})
            with LOCK:ATTEMPTS.pop(ip,None)
            token=secrets.token_urlsafe(36)
            digest=hashlib.sha256(token.encode()).hexdigest()
            with dbopen() as db:
                db.execute("DELETE FROM sessions WHERE expires<?",(int(now),))
                db.execute("INSERT INTO sessions VALUES(?,?)",(digest,int(now)+LIFETIME))
            return self.json_out(200,{"ok":True},{"Set-Cookie":self.cookie(token)})
        digest=self.session()
        if not digest:return self.json_out(401,{"error":"Bitte erneut anmelden"})
        if path=="/api/logout":
            with dbopen() as db:db.execute("DELETE FROM sessions WHERE digest=?",(digest,))
            return self.json_out(200,{"ok":True},{"Set-Cookie":self.cookie(expire=True)})
        if path=="/api/change-password":
            current,new=body.get("current"),body.get("new")
            if not isinstance(current,str) or not isinstance(new,str) or len(new)<12 or len(new.encode())>1024:return self.json_out(400,{"error":"Neues Passwort: mindestens 12 Zeichen"})
            with dbopen() as db:old=db.execute("SELECT password_hash FROM admin WHERE id=1").fetchone()
            if not old or not valid_password(current,old[0]):return self.json_out(403,{"error":"Altes Passwort falsch"})
            new_hash=digest_password(new)
            with dbopen() as db:
                db.execute("BEGIN IMMEDIATE")
                db.execute("UPDATE admin SET password_hash=? WHERE id=1",(new_hash,))
                db.execute("DELETE FROM sessions")
                db.commit()
            return self.json_out(200,{"ok":True},{"Set-Cookie":self.cookie(expire=True)})
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
    p=argparse.ArgumentParser()
    p.add_argument("cmd",nargs="?",choices=("serve","init-admin","reset-password"),default="serve")
    cmd=p.parse_args().cmd
    if cmd!="serve":return provision(cmd=="reset-password")
    initdb()
    with dbopen() as db:
        if not db.execute("SELECT 1 FROM admin WHERE id=1").fetchone():raise SystemExit("Zuerst: python3 server.py init-admin")
    app=ThreadingHTTPServer((HOST,PORT),Handler)
    print("Kalender laeuft auf http://%s:%d"%(HOST,PORT),flush=True)
    app.serve_forever()

if __name__=="__main__":main()
