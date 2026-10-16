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
        cls.temp=tempfile.TemporaryDirectory()
        os.environ["KALENDER_DATA_DIR"]=cls.temp.name
        os.environ["KALENDER_ORIGIN"]="http://127.0.0.1"
        spec=importlib.util.spec_from_file_location("kalender_server",Path(__file__).resolve().parents[1]/"server.py")
        cls.app=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.app)
        cls.app.initdb()
        cls.server=cls.app.ThreadingHTTPServer(("127.0.0.1",0),cls.app.Handler)
        cls.port=cls.server.server_address[1]
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)
        cls.temp.cleanup()

    def request(self,method,path,body=None,verified=False,origin=True):
        conn=http.client.HTTPConnection("127.0.0.1",self.port,timeout=5)
        headers={}
        if body is not None:
            body=json.dumps(body).encode()
            headers["Content-Type"]="application/json"
        if origin:headers["Origin"]="http://127.0.0.1"
        if verified:headers["X-Kalender-Verified"]="SUCCESS"
        conn.request(method,path,body=body,headers=headers)
        response=conn.getresponse()
        status=response.status
        raw=response.read()
        conn.close()
        data=json.loads(raw) if raw and response.getheader("Content-Type","").startswith("application/json") else None
        return status,data

    def test_mtls_proxy_gate_and_conflict(self):
        self.assertEqual(self.request("GET","/api/data")[0],403)
        self.assertEqual(self.request("GET","/api/session")[1]["authenticated"],False)
        self.assertEqual(self.request("GET","/api/session",verified=True)[1]["authenticated"],True)
        self.assertEqual(self.request("POST","/api/data",{},verified=True,origin=False)[0],403)
        self.assertEqual(self.request("POST","/api/data",{})[0],403)
        status,loaded=self.request("GET","/api/data",verified=True)
        self.assertEqual((status,loaded["version"]),(200,0))
        loaded["data"]["termine"]=[{"name":"Beispiel","id":1}]
        result=self.request("POST","/api/data",{"version":0,"data":loaded["data"]},verified=True)
        self.assertEqual((result[0],result[1]["version"]),(200,1))
        self.assertEqual(self.request("POST","/api/data",{"version":0,"data":loaded["data"]},verified=True)[0],409)
        self.assertEqual(self.request("GET","/api/export",verified=True)[0],200)
        self.assertEqual(self.request("POST","/api/login",{"password":"dummy"},verified=True)[0],404)

    def test_reject_html_payload_and_nonnumeric_ids(self):
        data=self.request("GET","/api/data",verified=True)[1]["data"]
        data["kunden"]=[{"id":123,"name":"<script>alert(1)</script>"}]
        self.assertEqual(self.request("POST","/api/data",{"version":1,"data":data},verified=True)[0],400)
        data["kunden"]=[{"id":"unsafe onclick","name":"Test"}]
        self.assertEqual(self.request("POST","/api/data",{"version":1,"data":data},verified=True)[0],400)

    def test_html_requires_proxy_verification(self):
        conn=http.client.HTTPConnection("127.0.0.1",self.port,timeout=5)
        conn.request("GET","/woche.html")
        response=conn.getresponse()
        self.assertEqual(response.status,302)
        self.assertEqual(response.getheader("Location"),"/index.html")
        response.read()
        conn.close()

if __name__=="__main__":unittest.main()
