#!/usr/bin/env python3
"""One-time import from the original Supabase systemdaten into private SQLite.

Reads the legacy URL + public ANON key from the last original main-branch code
already present in local Git history; never logs credentials or personal data.
Default checks counts only. --apply requires typed confirmation and backs up
the current SQLite DB; refuses to overwrite any nonempty/newer snapshot.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("KALENDER_DATA_DIR", "/var/lib/kalender"))
BACKUP_DIR = Path(os.getenv("KALENDER_BACKUP_DIR", "/var/backups/kalender"))
OLD_MAIN_SHA = "7b1854554732005226c927a7817c499efa08c6c4"

def server():
    spec = importlib.util.spec_from_file_location("kalender_backend", ROOT / "server.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def load_legacy_connection():
    source = subprocess.run(
        ["git", "-C", str(ROOT), "show", OLD_MAIN_SHA + ":app.js"],
        capture_output=True, text=True, check=True, timeout=15
    ).stdout
    u = re.search(r"const SUPABASE_URL\s*=\s*['\"](https://[a-z0-9-]+\.supabase\.co)['\"]", source)
    k = re.search(r"const SUPABASE_KEY\s*=\s*['\"]([^'\"]+)['\"]", source)
    if not u or not k:
        raise RuntimeError("Alte Supabase-Verbindung nicht im Git-Verlauf gefunden.")
    return u.group(1), k.group(1)

def fetch_legacy():
    base, key = load_legacy_connection()
    url = base + "/rest/v1/systemdaten?id=eq.1&select=*"
    req = urllib.request.Request(url, headers={
        "apikey": key, "Authorization": "Bearer " + key,
        "Cache-Control": "no-store", "Accept": "application/json",
        "User-Agent": "Kalender-One-Time-Migration/1.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            if response.status != 200: raise RuntimeError("Supabase hat keine Daten geliefert.")
            raw = response.read(10 * 1024 * 1024 + 1)
    except urllib.error.HTTPError as error:
        raise RuntimeError("Supabase verweigert den Zugriff (HTTP %d). Alte Browser-Daten exportieren." % error.code) from None
    except urllib.error.URLError as error:
        raise RuntimeError("Supabase nicht erreichbar. Alte Browser-Daten exportieren.") from None
    if len(raw) > 10 * 1024 * 1024:
        raise RuntimeError("Supabase-Datensatz zu groß. Manueller Export erforderlich.")
    records = json.loads(raw)
    if not isinstance(records, list) or len(records) != 1 or not isinstance(records[0], dict):
        raise RuntimeError("Datensatz 'systemdaten?id=1' fehlt oder ist mehrdeutig. Keine Daten importiert.")
    source = records[0]
    defaults = {"termine": [], "kunden": [], "einstellungen": {}, "events": [], "sperrzeiten": []}
    data = {key: source.get(key) if source.get(key) is not None else fallback for key, fallback in defaults.items()}
    for key, value in data.items():
        if not isinstance(value, type(defaults[key])):
            raise RuntimeError("Falscher Datentyp in " + key + ". Kein Import.")
    return data, source.get("last_update")

def print_summary(data, last_update):
    print("Alte Supabase-Daten wurden gefunden.")
    print("Letztes Cloud-Update:", str(last_update or "unbekannt"))
    for k in ("termine", "kunden", "events", "sperrzeiten"):
        print("  %s: %d" % (k, len(data[k])))
    print("  Einstellungen: %d Felder" % len(data["einstellungen"]))
    print("Keine Kunden- oder Termindetails ausgegeben. Keine PIN importiert.")

def perform_import(data, app):
    app.initdb()
    if not any([data["termine"], data["kunden"], data["events"], data["sperrzeiten"], data["einstellungen"]]):
        raise RuntimeError("Quelle vollständig leer – sicherheitshalber kein Import.")
    if not app.safe(data):
        raise RuntimeError("Die alten Daten enthalten Zeichen/IDs, die die neue HTML-Sicherheitsprüfung nicht zulässt. Nichts geändert. Bitte zunächst Datenbereinigung prüfen.")

    dbpath = DATA_DIR / "kalender.sqlite3"
    BACKUP_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(BACKUP_DIR, 0o700)
    stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    backup_path = BACKUP_DIR / ("vor-supabase-import-" + stamp + ".sqlite3")
    with sqlite3.connect(dbpath) as source:
        current_version, raw = source.execute("SELECT version,content FROM snapshot WHERE id=1").fetchone()
        current = json.loads(raw)
        empty = (current_version == 0 and current == app.EMPTY)
        if not empty:
            raise RuntimeError("Die Ziel-Datenbank wurde schon benutzt. Kein Überschreiben. Bitte Backups und Konflikte manuell vergleichen.")
        with sqlite3.connect(backup_path) as destination:
            source.backup(destination)
            valid = destination.execute("PRAGMA integrity_check").fetchone()[0]
            if valid != "ok": raise RuntimeError("Backup-Integritätsprüfung fehlgeschlagen: "+str(valid))
    os.chmod(backup_path, 0o600)
    print("Sicherung der alten SQLite-Zieldatenbank erstellt:", backup_path)

    with app.dbopen() as db:
        db.execute("BEGIN IMMEDIATE")
        version, content = db.execute("SELECT version,content FROM snapshot WHERE id=1").fetchone()
        if version != 0 or json.loads(content) != app.EMPTY:
            db.rollback()
            raise RuntimeError("Datenbank wurde zwischenzeitlich verändert. Kein Import.")
        db.execute("UPDATE snapshot SET version=1, content=? WHERE id=1",
                   (json.dumps(data, ensure_ascii=False, allow_nan=False),))
        db.commit()
    print("Daten sicher importiert. Kalender im Browser vollständig neu laden (Strg+F5).")
    print("Alte Supabase-Daten NICHT sofort löschen – erst die Vollständigkeit prüfen.")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Daten nach Vorschau, Bestätigung und SQLite-Backup importieren")
    args=parser.parse_args()
    app=server()
    data, last_update=fetch_legacy()
    print_summary(data,last_update)
    if not args.apply:
        print("Dies war nur eine Vorschau. Keine Daten geändert.")
        print("Für Import erneut mit --apply ausführen.")
        return
    print("Ziel: private SQLite-Datenbank. Nur wenn sie vollständig leer und unverändert ist.")
    if input("Import wirklich durchführen? Schreibe IMPORTIEREN: ").strip() != "IMPORTIEREN":
        print("Abgebrochen, keine Daten geändert.")
        return
    perform_import(data,app)

if __name__=="__main__":
    try: main()
    except (RuntimeError, ValueError, OSError, subprocess.CalledProcessError) as ex:
        print("STOP:",ex,file=sys.stderr)
        sys.exit(1)
