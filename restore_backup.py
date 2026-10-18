#!/usr/bin/env python3
"""Restore only a calendar snapshot from a verified SQLite backup.

Preserves current PIN hash and all login sessions. A separate fresh backup of
the live SQLite DB is created first. Never copy old SQLite over a live WAL DB.
Run as the unprivileged calendar user. Preview is the default.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import sys
import time

ROOT=Path(__file__).resolve().parent
DB_DIR=Path(os.environ.get("KALENDER_DATA_DIR","/var/lib/kalender"))
BACKUP_DIR=Path(os.environ.get("KALENDER_BACKUP_DIR","/var/backups/kalender"))

def app():
    spec=importlib.util.spec_from_file_location("kalender_app",ROOT/"server.py")
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def validated_backup(requested,app_module):
    filename=Path(requested).resolve()
    directory=BACKUP_DIR.resolve()
    if (filename.parent not in (directory, directory/"pre-delete") or
            filename.suffix!=".sqlite3" or not filename.is_file()):
        raise RuntimeError("Nur .sqlite3 Dateien aus dem geschützten Backup-Verzeichnis erlaubt.")
    db=sqlite3.connect("file:"+str(filename)+"?mode=ro",uri=True,timeout=15)
    try:
        if db.execute("PRAGMA integrity_check").fetchone()[0]!="ok":
            raise RuntimeError("Backup ist beschädigt.")
        row=db.execute("SELECT version,content FROM snapshot WHERE id=1").fetchone()
        if not row:raise RuntimeError("Backup enthält keinen Kalender-Datensatz.")
        version,raw=row
        data=json.loads(raw)
        if not isinstance(data,dict) or any(not isinstance(data.get(k),t) for k,t in app_module.FIELDS.items()):
            raise RuntimeError("Backup-Format unvollständig.")
        if not app_module.safe(data):
            raise RuntimeError("Backup enthält unzulässige Zeichen.")
        return version,data
    finally:
        db.close()

def restore(file,apply=False):
    application=app()
    application.initdb()
    backup_version,data=validated_backup(file,application)
    print("Geprüftes Backup, Revision:",backup_version)
    for k in ("termine","kunden","events","sperrzeiten"):
        print(" ",k,":",len(data[k]))
    print("Einstellungen:",len(data["einstellungen"]),"Felder")
    with application.dbopen() as db:
        current_version=db.execute("SELECT version FROM snapshot WHERE id=1").fetchone()[0]
    print("Aktuelle Serverrevision:",current_version)
    if not apply:
        print("VORSCHAU: Keine Daten verändert.")
        return
    if input("Nur Kalenderdaten auf diesen Backupstand setzen? RESTORE eingeben: ").strip()!="RESTORE":
        print("Abgebrochen.")
        return
    os.umask(0o077)
    BACKUP_DIR.mkdir(parents=True,exist_ok=True,mode=0o700)
    stamp=time.strftime("%Y%m%d-%H%M%S",time.gmtime())
    safety=BACKUP_DIR/("vor-restore-"+stamp+".sqlite3")
    if safety.exists():raise RuntimeError("Sicherungsname schon vergeben.")
    with sqlite3.connect(DB_DIR/"kalender.sqlite3") as live:
        with sqlite3.connect(safety) as out:
            live.backup(out)
            if out.execute("PRAGMA integrity_check").fetchone()[0]!="ok":
                raise RuntimeError("Aktuelles Datenbankbackup konnte nicht überprüft werden.")
    os.chmod(safety,0o600)
    print("Aktueller Datenbestand vor Änderung gesichert:",safety)
    with application.dbopen() as db:
        db.execute("BEGIN IMMEDIATE")
        now=db.execute("SELECT version FROM snapshot WHERE id=1").fetchone()[0]
        if now!=current_version:
            db.rollback()
            raise RuntimeError("Server wurde gleichzeitig verändert – nicht überschrieben.")
        db.execute("UPDATE snapshot SET version=?,content=? WHERE id=1",
                   (now+1,json.dumps(data,ensure_ascii=False,allow_nan=False)))
        db.commit()
    print("WIEDERHERGESTELLT. PIN und Geräte-Sitzungen sind erhalten.")
    print("Geöffnete Kalender auf anderen Geräten bitte aktualisieren.")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("file",help="Vollständiger Pfad zum .sqlite3-Backup unter /var/backups/kalender")
    p.add_argument("--apply",action="store_true")
    args=p.parse_args()
    restore(args.file,args.apply)

if __name__=="__main__":
    try:main()
    except (RuntimeError,ValueError,OSError,sqlite3.Error) as ex:
        print("STOP:",ex,file=sys.stderr);sys.exit(1)
