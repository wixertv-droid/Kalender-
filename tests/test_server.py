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
        with cls.app.dbopen() as db:
            db.execute("INSERT INTO admin VALUES(1,?)",(cls.app.digest_password("very-secure-test-password"),))
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

    def request(self,method,path,body=None,cookie=None,origin=True):
        conn=http.client.HTTPConnection("127.0.0.1",self.port,timeout=5)
        headers={}
        if body is not None:
            body=json.dumps(body).encode("utf-8")
            headers["Content-Type"]="application/json"
        if origin:headers["Origin"]="http://127.0.0.1"
        if cookie:headers["Cookie"]=cookie
        conn.request(method,path,body=body,headers=headers)
        response=conn.getresponse()
        status=response.status
        setcookie=response.getheader("Set-Cookie")
        raw=response.read()
        conn.close()
        return status,json.loads(raw) if raw and response.getheader("Content-Type","").startswith("application/json") else None,setcookie

    def test_login_data_conflicts_and_origin(self):
        status,_,_=self.request("GET","/api/data")
        self.assertEqual(status,401)
        status,_,_=self.request("POST","/api/login",{"password":"not-password"},origin=False)
        self.assertEqual(status,403)
        status,_,_=self.request("POST","/api/login",{"password":"incorrect"})
        self.assertEqual(status,401)
        status,_,header=self.request("POST","/api/login",{"password":"very-secure-test-password"})
        self.assertEqual(status,200)
        self.assertIn("HttpOnly",header)
        self.assertIn("Secure",header)
        cookie=header.split(";",1)[0]
        status,data,_=self.request("GET","/api/data",cookie=cookie)
        self.assertEqual((status,data["version"]),(200,0))
        data["data"]["termine"]=[{"name":"Test","id":1}]
        status,saved,_=self.request("POST","/api/data",{"version":0,"data":data["data"]},cookie)
        self.assertEqual((status,saved["version"]),(200,1))
        status,_,_=self.request("POST","/api/data",{"version":0,"data":data["data"]},cookie)
        self.assertEqual(status,409)
        status,_,_=self.request("GET","/api/export",cookie=cookie)
        self.assertEqual(status,200)
        status,_,_=self.request("POST","/api/logout",{},cookie)
        self.assertEqual(status,200)
        status,_,_=self.request("GET","/api/data",cookie=cookie)
        self.assertEqual(status,401)

    def test_html_requires_login(self):
        conn=http.client.HTTPConnection("127.0.0.1",self.port,timeout=5)
        conn.request("GET","/woche.html")
        response=conn.getresponse()
        self.assertEqual(response.status,302)
        self.assertEqual(response.getheader("Location"),"/index.html")
        response.read()
        conn.close()

if __name__=="__main__":
    unittest.main()
