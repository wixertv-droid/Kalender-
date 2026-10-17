import unittest
from schedule_validation import introduced_conflicts, overlaps

def data(t=None,e=None,s=None):
    return {"termine":t or [],"events":e or [],"sperrzeiten":s or [],
            "kunden":[],"einstellungen":{}}
def ap(id="1",datum="2026-11-12",start="15:00",ende="17:00"):
    return {"id":id,"datum":datum,"start":start,"ende":ende}
def block():
    return {"id":88,"startDatum":"2026-11-12","endDatum":"2026-11-12",
            "startZeit":"15:30","endZeit":"17:30"}

class ScheduleTests(unittest.TestCase):
    def test_appointment_against_event(self):
        old=data(t=[ap()])
        new=data(t=[ap()],e=[ap("2",start="16:00",ende="18:00")])
        self.assertTrue(introduced_conflicts(old,new))

    def test_contiguous_allowed(self):
        self.assertFalse(overlaps(data(t=[ap("1",ende="16:00"),ap("2",start="16:00")])))

    def test_event_against_event(self):
        self.assertTrue(overlaps(data(e=[ap("1"),ap("2",start="16:30")])))

    def test_appointment_against_block(self):
        self.assertTrue(overlaps(data(t=[ap()],s=[block()])))

    def test_legacy_conflict_preserved_on_unrelated_edit(self):
        existing=data(t=[ap()],e=[ap("2",start="16:00")])
        other=data(t=[dict(ap(), name="Aktualisiert")],e=[ap("2",start="16:00")])
        self.assertFalse(introduced_conflicts(existing,other))

    def test_change_adds_conflict(self):
        old=data(t=[ap(),ap("2",start="17:00",ende="18:00")])
        new=data(t=[ap(),ap("2",start="16:00",ende="18:00")])
        self.assertTrue(introduced_conflicts(old,new))

    def test_cross_midnight(self):
        a=ap("1",start="23:30",ende="01:00")
        b=ap("2",datum="2026-11-13",start="00:30",ende="01:30")
        self.assertTrue(overlaps(data(t=[a,b])))

if __name__=="__main__":
    unittest.main()
