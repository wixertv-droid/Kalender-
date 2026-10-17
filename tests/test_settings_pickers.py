"""Regression checks for iPhone-compatible settings date/time pickers."""
import unittest
from pathlib import Path
from html.parser import HTMLParser

HTML = (Path(__file__).resolve().parents[1] / "einstellungen.html").read_text(encoding="utf-8")
IDS = {
    "arbeitsStart": "time",
    "arbeitsEnde": "time",
    "sperrStartDatum": "date",
    "sperrStartZeit": "time",
    "sperrEndDatum": "date",
    "sperrEndZeit": "time",
}
class Inputs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inputs = []
        self.faces = []
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "input":
            self.inputs.append(values)
        elif tag == "span" and values.get("data-for"):
            self.faces.append(values)

class PickerRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parser = Inputs()
        cls.parser.feed(HTML)

    def test_original_ids_and_native_picker_types_preserved(self):
        for ident, typ in IDS.items():
            inputs = [i for i in self.parser.inputs if i.get("id") == ident]
            self.assertEqual(len(inputs), 1, "Input duplicate/missing: " + ident)
            self.assertEqual(inputs[0].get("type"), typ)
            self.assertIn("picker-native", inputs[0].get("class", ""))
            self.assertNotIn("disabled", inputs[0])
            self.assertNotIn("readonly", inputs[0])

    def test_visible_text_layer_for_every_input(self):
        for ident in IDS:
            faces = [i for i in self.parser.faces if i.get("data-for") == ident]
            self.assertEqual(len(faces), 1, "Display missing/duplicate: " + ident)

    def test_initial_time_values_remain(self):
        by_id = {i.get("id"): i for i in self.parser.inputs}
        self.assertEqual(by_id["sperrStartZeit"]["value"], "00:00")
        self.assertEqual(by_id["sperrEndZeit"]["value"], "23:59")

    def test_clickable_native_input_stays_and_display_remains_left_aligned(self):
        self.assertIn(".picker-shell > input.picker-native", HTML)
        self.assertIn("opacity: 0", HTML)
        self.assertIn("text-align: left", HTML)
        self.assertIn("position: absolute", HTML)
        self.assertIn("document.addEventListener('DOMContentLoaded'", HTML)
        self.assertIn("input.addEventListener('change', refreshStyledPickers)", HTML)
        self.assertIn("setTimeout(refreshStyledPickers, 0)", HTML)
        self.assertIn("refreshStyledPickers();", HTML)

if __name__ == "__main__":
    unittest.main()
