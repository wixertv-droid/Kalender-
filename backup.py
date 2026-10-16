#!/usr/bin/env python3
"""Consistent online SQLite backups (no copying a live WAL file)."""
import os, sqlite3
from datetime import datetime, timezone
from pathlib import Path

source=Path(os.environ.get("KALENDER_DATA_DIR","/var/lib/kalender"))/"kalender.sqlite3"
target=Path(os.environ.get("KALENDER_BACKUP_DIR","/var/backups/kalender"))
keep=int(os.environ.get("KALENDER_BACKUP_KEEP_DAYS","30"))
os.umask(0o077)
target.mkdir(parents=True,exist_ok=True,mode=0o700)
os.chmod(target,0o700)
if not source.is_file():raise SystemExit("Datenbank nicht gefunden: "+str(source))
filename=target/("kalender-"+datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")+".sqlite3")
src=sqlite3.connect("file:"+str(source)+"?mode=ro",uri=True,timeout=15)
dest=sqlite3.connect(filename)
try:
    src.backup(dest)
    result=dest.execute("PRAGMA integrity_check").fetchone()[0]
    if result!="ok":raise RuntimeError("SQLite integrity_check: "+result)
finally:
    dest.close()
    src.close()
os.chmod(filename,0o600)
from time import time
for old in target.glob("kalender-*.sqlite3"):
    if old!=filename and old.stat().st_mtime < time()-keep*86400:
        old.unlink()
print("Backup erstellt:",filename)
