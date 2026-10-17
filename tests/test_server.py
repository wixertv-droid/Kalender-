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

    def test_selective_delete_creates_backup_and_only_changes_requested_items(self):
        import sqlite3
        from pathlib import Path
        backup_dir=Path(self.temp.name)/"secure-backups"
        previous=os.environ.get("KALENDER_BACKUP_DIR")
        os.environ["KALENDER_BACKUP_DIR"]=str(backup_dir)
        cookie=self.login()
        try:
            _,old,_,_=self.request("GET","/api/data",verified=True,cookie=cookie)
            version=old["version"]
            data=old["data"]
            test_customer={"id":91810001,"name":"Testkunde"}
            other_customer={"id":91810002,"name":"Bleibt erhalten"}
            data["kunden"].extend([test_customer,other_customer])
            data["termine"].extend([
                {"id":91810003,"name":"Löschtermin","kunde_id":91810001,"status":"done","umsatz":"120"},
                {"id":91810004,"name":"Behalten","kunde_id":91810001,"status":"done","umsatz":"220"}
            ])
            data["events"].append({"id":91810005,"name":"Testevent","kosten":40,"guests":[
                {"id":91810006,"name":"Testgast","kundeId":91810001,"anzahlung":30,"restzahlung":25}
            ]})
            status,save,_,_=self.request("POST","/api/data",
                 {"version":version,"data":data},verified=True,cookie=cookie)
            self.assertEqual(status,200)
            current=save["version"]
            operation={"version":current,"category":"termine",
                       "ids":["91810003"],"confirmation":"LOESCHEN"}
            self.assertEqual(self.request("POST","/api/delete-selected",operation,verified=True)[0],401)
            self.assertEqual(self.request("POST","/api/delete-selected",operation,verified=True,cookie=cookie,origin=False)[0],403)
            invalid=dict(operation,confirmation="FALSE")
            self.assertEqual(self.request("POST","/api/delete-selected",invalid,verified=True,cookie=cookie)[0],400)
            self.assertEqual(self.request("POST","/api/delete-selected",
                dict(operation,ids=["1234567812345678"]),verified=True,cookie=cookie)[0],400)
            status,result,_,_=self.request("POST","/api/delete-selected",operation,
                                           verified=True,cookie=cookie)
            self.assertEqual(status,200)
            self.assertEqual((result["deleted"],result["unlinked"]),(1,0))
            self.assertEqual(result["version"],current+1)
            backups=list(backup_dir.glob("kalender-vor-loeschen-*.sqlite3"))
            self.assertEqual(len(backups),1)
            with sqlite3.connect(backups[0]) as db:
                self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0],"ok")
                old_data=json.loads(db.execute("SELECT content FROM snapshot WHERE id=1").fetchone()[0])
                self.assertTrue(any(x["id"]==91810003 for x in old_data["termine"]))
            _,new,_,_=self.request("GET","/api/data",verified=True,cookie=cookie)
            self.assertFalse(any(x["id"]==91810003 for x in new["data"]["termine"]))
            self.assertTrue(any(x["id"]==91810004 for x in new["data"]["termine"]))
            self.assertEqual(new["data"]["events"][-1]["guests"][0]["restzahlung"],25)
            self.assertEqual(self.request("POST","/api/delete-selected",operation,
                                           verified=True,cookie=cookie)[0],409)
            # Customer removal retains appointment and event receipts.
            version=new["version"]
            status,result,_,_=self.request("POST","/api/delete-selected",
                {"version":version,"category":"kunden","ids":["91810001"],
                 "confirmation":"LOESCHEN"},verified=True,cookie=cookie)
            self.assertEqual(status,200)
            self.assertEqual(result["unlinked"],2)
            _,after,_,_=self.request("GET","/api/data",verified=True,cookie=cookie)
            self.assertFalse(any(k["id"]==91810001 for k in after["data"]["kunden"]))
            self.assertTrue(any(k["id"]==91810002 for k in after["data"]["kunden"]))
            retained=next(x for x in after["data"]["termine"] if x["id"]==91810004)
            self.assertEqual(retained["umsatz"],"220")
            self.assertNotIn("kunde_id",retained)
            guest=after["data"]["events"][-1]["guests"][0]
            self.assertEqual(guest["anzahlung"],30)
            self.assertNotIn("kundeId",guest)
            # Event removal has no effect on other financial records.
            status,result,_,_=self.request("POST","/api/delete-selected",
                {"version":after["version"],"category":"events","ids":["91810005"],
                 "confirmation":"LOESCHEN"},verified=True,cookie=cookie)
            self.assertEqual(status,200)
            _,last,_,_=self.request("GET","/api/data",verified=True,cookie=cookie)
            self.assertFalse(any(e["id"]==91810005 for e in last["data"]["events"]))
            self.assertEqual(next(x for x in last["data"]["termine"] if x["id"]==91810004)["umsatz"],"220")
            self.assertEqual(len(list(backup_dir.glob("kalender-vor-loeschen-*.sqlite3"))),3)
        finally:
            if previous is None:os.environ.pop("KALENDER_BACKUP_DIR",None)
            else:os.environ["KALENDER_BACKUP_DIR"]=previous

    def test_xss_guard(self):
        cookie=self.login()
        data=self.request("GET","/api/data",verified=True,cookie=cookie)[1]
        version=data["version"]
        data["data"]["kunden"]=[{"id":123,"name":"<script>alert(1)</script>"}]
        self.assertEqual(self.request("POST","/api/data",{"version":version,"data":data["data"]},verified=True,cookie=cookie)[0],400)
        data["data"]["kunden"]=[{"id":"unsafe onclick","name":"Test"}]
        self.assertEqual(self.request("POST","/api/data",{"version":version,"data":data["data"]},verified=True,cookie=cookie)[0],400)

    def test_pin_still_required_without_device_cert_gate(self):
        old = self.app.REQUIRE_DEVICE_CERT
        try:
            self.app.REQUIRE_DEVICE_CERT = False
            self.assertEqual(self.request("GET", "/api/data")[0], 401)
            self.assertEqual(self.request("GET", "/api/session")[1]["authenticated"], False)
            status, result, cookie, _ = self.request("POST", "/api/login", {"pin":"4729"})
            self.assertEqual(status, 200)
            self.assertIsNotNone(cookie)
            self.assertEqual(self.request("GET", "/api/data", cookie=cookie.split(";",1)[0])[0], 200)
        finally:
            self.app.REQUIRE_DEVICE_CERT = old

    def test_server_rejects_new_event_booking_overlap_and_keeps_revision(self):
        cookie=self.login()
        _,snapshot,_,_=self.request("GET","/api/data",verified=True,cookie=cookie)
        version=snapshot["version"]
        data=snapshot["data"]
        data["termine"].append({"id":99887766101,"name":"Termin A","datum":"2041-05-12",
                                "start":"12:00","ende":"14:00"})
        data["events"].append({"id":99887766102,"name":"Event B","datum":"2041-05-12",
                               "start":"13:00","ende":"15:00","guests":[]})
        result=self.request("POST","/api/data",{"version":version,"data":data},verified=True,cookie=cookie)
        self.assertEqual(result[0],422)
        _,after,_,_=self.request("GET","/api/data",verified=True,cookie=cookie)
        self.assertEqual(after["version"],version)
        self.assertEqual(after["data"]["termine"],snapshot["data"]["termine"][:-1])

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
