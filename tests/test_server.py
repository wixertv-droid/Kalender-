import http.client
import importlib.util
import json
import os
import tempfile
import threading
import unittest
from pathlib import Path

class CalendarAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        os.environ["KALENDER_DATA_DIR"] = cls.temp.name
        os.environ["KALENDER_ORIGIN"] = "http://127.0.0.1"
        spec = importlib.util.spec_from_file_location("kalender_server", Path(__file__).resolve().parents[1] / "server.py")
        cls.app = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.app)
        cls.app.initdb()
        with cls.app.dbopen() as db:
            db.execute("INSERT INTO pin_auth VALUES (1,?)", (cls.app.make_pin_hash("4729"),))
        cls.server = cls.app.ThreadingHTTPServer(("127.0.0.1", 0), cls.app.Handler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)
        cls.temp.cleanup()

    def request(self, method, path, body=None, verified=False, cookie=None, origin=True, ip="192.0.2.1"):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        headers = {"X-Real-IP": ip}
        if body is not None:
            body = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        if origin: headers["Origin"] = "http://127.0.0.1"
        if verified: headers["X-Kalender-Verified"] = "SUCCESS"
        if cookie: headers["Cookie"] = cookie
        conn.request(method, path, body=body, headers=headers)
        response = conn.getresponse()
        status = response.status
        set_cookie = response.getheader("Set-Cookie")
        other = {"Location": response.getheader("Location")}
        raw = response.read()
        conn.close()
        data = json.loads(raw) if raw and response.getheader("Content-Type", "").startswith("application/json") else None
        return status, data, set_cookie, other

    def login(self):
        status, data, cookie, _ = self.request("POST","/api/login",{"pin":"4729"},verified=True)
        self.assertEqual(status,200)
        self.assertTrue(data["ok"])
        self.assertIn("Secure", cookie)
        self.assertIn("HttpOnly",cookie)
        return cookie.split(";",1)[0]

    def test_requires_both_certificate_and_pin(self):
        self.assertEqual(self.request("GET","/api/data")[0],403)
        self.assertEqual(self.request("GET","/api/data",verified=True)[0],401)
        self.assertEqual(self.request("GET","/api/session",verified=True)[1]["authenticated"],False)
        self.assertEqual(self.request("GET","/api/session",verified=True)[1]["pinConfigured"],True)
        self.assertEqual(self.request("POST","/api/login",{"pin":"4729"},verified=False)[0],403)
        self.assertEqual(self.request("POST","/api/login",{"pin":"4729"},verified=True,origin=False)[0],403)
        self.assertEqual(self.request("POST","/api/login",{"pin":"0000"},verified=True)[0],401)
        cookie=self.login()
        self.assertEqual(self.request("GET","/api/session",verified=True,cookie=cookie)[1]["authenticated"],True)
        self.assertEqual(self.request("GET","/api/data",verified=True,cookie=cookie)[0],200)
        self.assertEqual(self.request("GET","/api/data",verified=False,cookie=cookie)[0],403)
        self.assertEqual(self.request("POST","/api/logout",{},verified=True,cookie=cookie)[0],200)
        self.assertEqual(self.request("GET","/api/data",verified=True,cookie=cookie)[0],401)

    def test_version_conflicts_and_export(self):
        cookie=self.login()
        status,loaded,_,_=self.request("GET","/api/data",verified=True,cookie=cookie)
        self.assertEqual(status,200)
        version=loaded["version"]
        loaded["data"]["termine"]=[{"name":"Beispiel","id":1}]
        result=self.request("POST","/api/data",{"version":version,"data":loaded["data"]},verified=True,cookie=cookie)
        self.assertEqual((result[0],result[1]["version"]),(200,version+1))
        self.assertEqual(self.request("POST","/api/data",{"version":version,"data":loaded["data"]},verified=True,cookie=cookie)[0],409)
        self.assertEqual(self.request("GET","/api/export",verified=True,cookie=cookie)[0],200)

    def test_xss_guard(self):
        cookie=self.login()
        data=self.request("GET","/api/data",verified=True,cookie=cookie)[1]
        version=data["version"]
        data["data"]["kunden"]=[{"id":123,"name":"<script>alert(1)</script>"}]
        self.assertEqual(self.request("POST","/api/data",{"version":version,"data":data["data"]},verified=True,cookie=cookie)[0],400)
        data["data"]["kunden"]=[{"id":"unsafe onclick","name":"Test"}]
        self.assertEqual(self.request("POST","/api/data",{"version":version,"data":data["data"]},verified=True,cookie=cookie)[0],400)

    def test_rate_limit_and_login_page(self):
        ip="192.0.2.88"
        for _ in range(5):
            self.assertEqual(self.request("POST","/api/login",{"pin":"9998"},verified=True,ip=ip)[0],401)
        self.assertEqual(self.request("POST","/api/login",{"pin":"4729"},verified=True,ip=ip)[0],429)
        status,_,_,meta=self.request("GET","/woche.html",verified=True)
        self.assertEqual(status,302)
        self.assertEqual(meta["Location"],"/index.html")
        self.assertEqual(self.request("GET","/index.html",verified=True)[0],200)

if __name__=="__main__":unittest.main()
