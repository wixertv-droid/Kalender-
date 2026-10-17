import unittest
from copy import deepcopy
from selective_delete import remove_selected, SelectionError

BASE={
    "termine":[
        {"id":1,"kunde_id":10,"name":"Testtermin","status":"done","umsatz":"120"},
        {"id":2,"kunde_id":20,"name":"Echter Termin","status":"done","umsatz":"200"},
    ],
    "kunden":[{"id":10,"name":"Testkunde"},{"id":20,"name":"Echter Kunde"}],
    "events":[
        {"id":50,"name":"Event mit Gast","kosten":30,"guests":[
            {"id":70,"kundeId":10,"name":"Testgast","anzahlung":10,"restzahlung":20},
            {"id":71,"kundeId":20,"name":"Anderer Gast","anzahlung":40,"restzahlung":40},
        ]},
        {"id":51,"name":"Echtes Event","guests":[]}
    ],
    "einstellungen":{"kat1_name":"VIP"},
    "sperrzeiten":[{"id":3,"name":"Urlaub"}]
}
class SelectiveDeleteUnitTests(unittest.TestCase):
    def test_remove_only_selected_appointment_leaves_other_values(self):
        original=deepcopy(BASE)
        result,count,linked=remove_selected(BASE,"termine",["1"])
        self.assertEqual((count,linked),(1,0))
        self.assertEqual(result["termine"],[BASE["termine"][1]])
        self.assertEqual(result["events"],BASE["events"])
        self.assertEqual(result["kunden"],BASE["kunden"])
        self.assertEqual(result["einstellungen"],BASE["einstellungen"])
        self.assertEqual(BASE,original)
    def test_remove_one_event_removes_its_finances_but_keeps_other(self):
        result,count,_=remove_selected(BASE,"events",["50"])
        self.assertEqual(count,1)
        self.assertEqual([e["id"] for e in result["events"]],[51])
        self.assertEqual(result["termine"],BASE["termine"])
        self.assertEqual(result["kunden"],BASE["kunden"])
    def test_customer_deletion_keeps_historical_revenue_and_unlinks(self):
        result,count,linked=remove_selected(BASE,"kunden",["10"])
        self.assertEqual((count,linked),(1,2))
        self.assertEqual(result["termine"][0]["umsatz"],"120")
        self.assertNotIn("kunde_id",result["termine"][0])
        self.assertEqual(result["termine"][1]["kunde_id"],20)
        self.assertEqual(result["events"][0]["guests"][0]["restzahlung"],20)
        self.assertNotIn("kundeId",result["events"][0]["guests"][0])
        self.assertEqual(result["events"][0]["guests"][1]["kundeId"],20)
        self.assertEqual(result["einstellungen"],BASE["einstellungen"])
    def test_reject_unsafe_selection(self):
        for c, ids in (("sperrzeiten",["3"]),("termine",[]),("termine",["1","1"]),
                       ("termine",["999"]),("termine",["1 OR TRUE"]),("termine",["1"]*201)):
            with self.subTest(category=c,ids=ids[:3]):
                with self.assertRaises(SelectionError):remove_selected(BASE,c,ids)
    def test_refuse_ambiguous_duplicates(self):
        data=deepcopy(BASE)
        data["kunden"].append({"id":10,"name":"Doppelt"})
        with self.assertRaisesRegex(SelectionError,"nicht eindeutig"):
            remove_selected(data,"kunden",["10"])
    def test_id_zero_not_lost(self):
        data=deepcopy(BASE)
        data["termine"].append({"id":0,"name":"Null"})
        result,count,_=remove_selected(data,"termine",["0"])
        self.assertEqual(count,1)
        self.assertFalse(any(t["id"]==0 for t in result["termine"]))

if __name__=="__main__":
    unittest.main()
