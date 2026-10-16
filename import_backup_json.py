#!/usr/bin/env python3
"""Safely restore an old Agenda 2050 JSON export into an EMPTY private SQLite snapshot.

Usage (dry run):
  python3 import_backup_json.py /var/lib/kalender/agenda2050-import.json
Commit:
  python3 import_backup_json.py --apply /var/lib/kalender/agenda2050-import.json

Never modifies an existing nonempty snapshot. Always backs up SQLite before
writing, using sqlite3.Connection.backup() to include any live WAL changes.
Does not load, modify, or reset PIN/sessions.
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
FIELDS=("termine","kunden","einstellungen","events","sperrzeiten")
DEFAULT={"termine":[],"kunden":[],"einstellungen":{},"events":[],"sperrzeiten":[]}
MAX_FILE=10*1024*1024

def get_app():
    spec=importlib.util.spec_from_file_location("kalender_backend",ROOT/"server.py")
    obj=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj

def load_backup(path,app):
    if not path.is_file() or path.stat().st_size>MAX_FILE:
        raise RuntimeError("JSON-Datei nicht gefunden oder zu groß.")
    with path.open("r",encoding="utf-8-sig") as fh:
        payload=json.load(fh)
    if not isinstance(payload,dict):
        raise RuntimeError("Backup muss ein JSON-Objekt sein.")
    data=payload.get("data",payload)
    if not isinstance(data,dict):
        raise RuntimeError("Backup-Daten fehlen.")
    if not all(k in data for k in ("termine","kunden","einstellungen")):
        raise RuntimeError("Mindestens termine, kunden und einstellungen müssen im Backup vorhanden sein.")
    normalized={}
    for key in FIELDS:
        value=data.get(key,DEFAULT[key])
        if not isinstance(value,type(DEFAULT[key])):
            raise RuntimeError("Ungültiger Datentyp bei "+key)
        normalized[key]=value
    if not app.safe(normalized):
        raise RuntimeError("Backup enthält von der App nicht zugelassene HTML-Zeichen oder IDs. Bitte prüfen, nicht ungefiltert importieren.")
    if not any(normalized.values()):
        raise RuntimeError("Backup enthält überhaupt keine Einträge; Import verweigert.")
    return normalized,payload.get("exportDate","unbekannt")

def summary(data,export):
    print("Backup vom:", export)
    for key in ("termine","kunden","events","sperrzeiten"):
        print("%s: %d"%(key,len(data[key])))
    print("Einstellungen: %d Felder"%len(data["einstellungen"]))
    print("Keine persönlichen Datensätze angezeigt.")

def import_data(data,app):
    app.initdb()
    source=DB_DIR/"kalender.sqlite3"
    BACKUP_DIR.mkdir(parents=True,exist_ok=True,mode=0o700)
    os.chmod(BACKUP_DIR,0o700)
    with app.dbopen() as db:
        version,content=db.execute("SELECT version,content FROM snapshot WHERE id=1").fetchone()
    if version!=0 or json.loads(content)!=app.EMPTY:
        raise RuntimeError("Die Serverdatenbank ist nicht mehr leer/unverändert. Kein Überschreiben! Bitte Daten vergleichen.")
    stamp=time.strftime("%Y%m%d-%H%M%S",time.gmtime())
    backup=BACKUP_DIR/("vor-json-import-"+stamp+".sqlite3")
    if backup.exists():
        raise RuntimeError("Backup-Dateiname existiert bereits; bitte erneut versuchen.")
    # All queries and backups are performed as the unprivileged kalender user.
    os.umask(0o077)
    with sqlite3.connect(source,timeout=15) as original:
        with sqlite3.connect(backup) as destination:
            original.backup(destination)
            if destination.execute("PRAGMA integrity_check").fetchone()[0]!="ok":
                raise RuntimeError("SQLite-Backup ist beschädigt. Import verweigert.")
    os.chmod(backup,0o600)
    print("SQLite-Sicherung erstellt:",backup)
    with app.dbopen() as db:
        db.execute("BEGIN IMMEDIATE")
        latest_version,latest_content=db.execute("SELECT version,content FROM snapshot WHERE id=1").fetchone()
        if latest_version!=0 or json.loads(latest_content)!=app.EMPTY:
            db.rollback()
            raise RuntimeError("Zwischenzeitlich wurden Daten geändert. Import abgebrochen.")
        db.execute("UPDATE snapshot SET version=1,content=? WHERE id=1",
            (json.dumps(data,ensure_ascii=False,allow_nan=False),))
        db.commit()
    print("IMPORT ERFOLGREICH. Bitte alle Datensätze im Kalender überprüfen.")
    print("Alte Backupdatei aufbewahren; spätere Termine/Events sind eventuell nicht enthalten.")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("file",type=Path)
    p.add_argument("--apply",action="store_true")
    args=p.parse_args()
    app=get_app()
    data,stamp=load_backup(args.file,app)
    summary(data,stamp)
    app.initdb()
    with app.dbopen() as db:
        version,raw=db.execute("SELECT version,content FROM snapshot WHERE id=1").fetchone()
    if version!=0 or json.loads(raw)!=app.EMPTY:
        raise RuntimeError("Server ist nicht mehr leer. Kein Import! Version: %s"%version)
    if not args.apply:
        print("VORSCHAU: Keine Daten verändert. Für Import --apply verwenden.")
        return
    if input("Zum Import das Wort IMPORTIEREN eingeben: ").strip()!="IMPORTIEREN":
        print("Abbruch, nichts verändert.")
        return
    import_data(data,app)

if __name__=="__main__":
    try:main()
    except (RuntimeError,ValueError,TypeError,sqlite3.Error,json.JSONDecodeError,OSError) as error:
        print("STOP:",error,file=sys.stderr)
        sys.exit(1)
