import importlib.util
import io
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("migration",ROOT/"migrate_from_supabase.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class MigrationBootstrapTests(unittest.TestCase):
    def test_reads_pinned_main_source_without_git(self):
        sample=b"""const SUPABASE_URL = 'https://exampletest.supabase.co';
const SUPABASE_KEY = 'example-public-anon-key';"""
        with mock.patch.object(module.urllib.request,"urlopen",return_value=io.BytesIO(sample)) as fetched:
            url,key=module.load_legacy_connection()
        self.assertEqual(url,"https://exampletest.supabase.co")
        self.assertEqual(key,"example-public-anon-key")
        self.assertIn("/7b1854554732005226c927a7817c499efa08c6c4/app.js", fetched.call_args[0][0].full_url)
    def test_rejects_missing_credentials(self):
        with mock.patch.object(module.urllib.request,"urlopen",return_value=io.BytesIO(b"// nothing")):
            with self.assertRaisesRegex(RuntimeError,"nicht in der Originaldatei"):
                module.load_legacy_connection()

if __name__=="__main__":
    unittest.main()
