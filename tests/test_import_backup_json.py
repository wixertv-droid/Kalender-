import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("backup_import",ROOT/"import_backup_json.py")
imp=importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)

class JSONImportTests(unittest.TestCase):
    def test_legacy_json_shape_and_safe_import(self):
        with tempfile.TemporaryDirectory() as tmp:
            old_data_dir=os.environ.get("KALENDER_DATA_DIR")
            try:
                os.environ["KALENDER_DATA_DIR"]=tmp
                app=imp.get_app()
                app.initdb()
                data_path=Path(tmp)/"incoming.json"
                legacy={
                    "termine":[{"id":1770000000000,"name":"Beispiel","datum":"2026-03-18","start":"15:00","ende":"17:00"}],
                    "kunden":[{"id":1770000000001,"name":"Beispiel"}],
                    "einstellungen":{"arbeitsStart":"08:00"},
                    "exportDate":"2026-03-23T09:22:08Z"
                }
                data_path.write_text(json.dumps(legacy),encoding="utf-8")
                normalized,stamp=imp.load_backup(data_path,app)
                self.assertEqual(stamp,legacy["exportDate"])
                self.assertEqual(normalized["events"],[])
                self.assertEqual(normalized["sperrzeiten"],[])
                orig_backups=imp.BACKUP_DIR
                imp.BACKUP_DIR=Path(tmp)/"backups"
                imp.DB_DIR=Path(tmp)
                try:
                    imp.import_data(normalized,app)
                    with app.dbopen() as db:
                        version,raw=db.execute("SELECT version,content FROM snapshot WHERE id=1").fetchone()
                    self.assertEqual(version,1)
                    self.assertEqual(json.loads(raw)["termine"],legacy["termine"])
                    self.assertTrue(list(imp.BACKUP_DIR.glob("vor-json-import-*.sqlite3")))
                    with self.assertRaisesRegex(RuntimeError,"nicht mehr leer"):
                        imp.import_data(normalized,app)
                finally:
                    imp.BACKUP_DIR=orig_backups
            finally:
                if old_data_dir is None: os.environ.pop("KALENDER_DATA_DIR",None)
                else: os.environ["KALENDER_DATA_DIR"]=old_data_dir

    def test_reject_invalid_and_xss_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            old=os.environ.get("KALENDER_DATA_DIR")
            try:
                os.environ["KALENDER_DATA_DIR"]=tmp
                app=imp.get_app()
                f=Path(tmp)/"import.json"
                f.write_text(json.dumps({"termine":[],"kunden":[]}),encoding="utf-8")
                with self.assertRaisesRegex(RuntimeError,"Mindestens"):
                    imp.load_backup(f,app)
                f.write_text(json.dumps({"termine":[],"kunden":[{"id":1,"name":"<script>bad</script>"}],"einstellungen":{}}),encoding="utf-8")
                with self.assertRaisesRegex(RuntimeError,"HTML"):
                    imp.load_backup(f,app)
            finally:
                if old is None: os.environ.pop("KALENDER_DATA_DIR",None)
                else: os.environ["KALENDER_DATA_DIR"]=old
