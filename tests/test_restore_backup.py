import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("kalender_restore",ROOT/"restore_backup.py")
restore=importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore)

class SafeRestoreTests(unittest.TestCase):
    def test_restore_only_snapshot_preserves_pin_and_creates_safety_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            previous=os.environ.get("KALENDER_DATA_DIR")
            data=Path(tmp)/"db"
            data.mkdir()
            backups=Path(tmp)/"backups"
            backups.mkdir()
            old_db_dir,old_backup_dir=restore.DB_DIR,restore.BACKUP_DIR
            os.environ["KALENDER_DATA_DIR"]=str(data)
            restore.DB_DIR,restore.BACKUP_DIR=data,backups
            try:
                a=restore.app()
                a.initdb()
                original=a.EMPTY.copy()
                original["kunden"]=[{"id":100,"name":"Kunde"}]
                with a.dbopen() as db:
                    db.execute("INSERT INTO pin_auth VALUES (1,?)",("test-hashed-pin",))
                    db.execute("UPDATE snapshot SET version=1,content=? WHERE id=1",(json.dumps(original),))
                backup=backups/"kalender-20010101-000000.sqlite3"
                with sqlite3.connect(data/"kalender.sqlite3") as source:
                    with sqlite3.connect(backup) as dest:
                        source.backup(dest)
                with a.dbopen() as db:
                    db.execute("UPDATE snapshot SET version=2,content=? WHERE id=1",(json.dumps(a.EMPTY),))
                with patch("builtins.input",return_value="RESTORE"):
                    restore.restore(str(backup),apply=True)
                with a.dbopen() as db:
                    version,content=db.execute("SELECT version,content FROM snapshot WHERE id=1").fetchone()
                    pin=db.execute("SELECT pin_hash FROM pin_auth WHERE id=1").fetchone()[0]
                self.assertEqual(version,3)
                self.assertEqual(json.loads(content)["kunden"],original["kunden"])
                self.assertEqual(pin,"test-hashed-pin")
                self.assertTrue(list(backups.glob("vor-restore-*.sqlite3")))
            finally:
                restore.DB_DIR,restore.BACKUP_DIR=old_db_dir,old_backup_dir
                if previous is None:os.environ.pop("KALENDER_DATA_DIR",None)
                else:os.environ["KALENDER_DATA_DIR"]=previous

    def test_reject_backup_outside_private_backup_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=Path(tmp)/"untrusted.sqlite3"
            f.touch()
            a=restore.app()
            with self.assertRaisesRegex(RuntimeError,"geschützten Backup"):
                restore.validated_backup(str(f),a)

if __name__=="__main__":
    unittest.main()
