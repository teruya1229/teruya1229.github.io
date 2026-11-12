import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import cpsc_candidates as c


def rec(brand, description, title=None):
    return {"RecallID": 11046, "RecallNumber": "27069",
            "Title": title or brand + " Recalls Example", "Description": description,
            "Products": [{"Name": brand + " device"}],
            "URL": "https://www.cpsc.gov/Recalls/2027/Example"}


def item(brand, model, upc=""):
    return {"item_id": "TEST1", "brand": brand, "model": model, "upc": upc}


class ExtractTests(unittest.TestCase):
    def test_model_pair(self):
        self.assertEqual(c.extract_explicit_models("model numbers KT-CS17 and LY-31."), ["KT-CS17", "LY-31"])

    def test_model_list(self):
        self.assertEqual(c.extract_explicit_models("model numbers BRZ0083, BRZ0154 and BRZ0156."), ["BRZ0083", "BRZ0154", "BRZ0156"])

    def test_models_phrase(self):
        self.assertEqual(c.extract_explicit_models("bicycles, models SS24001 and SS24002."), ["SS24001", "SS24002"])

    def test_manufacture_codes_are_not_models(self):
        self.assertEqual(c.extract_explicit_models("The Model number GTF7530 and codes 3021 to 0126 can be found."), ["GTF7530"])

    def test_vin_ranges_are_not_models(self):
        sample = "VIN Numbers range from XXXXXXXXXXX005992- XXXXXXXXXXX006074 (2025 models) and XXXXXXXXXXX006077- XXXXXXXXXXX006152 (2026 models)."
        self.assertEqual(c.extract_explicit_models(sample), [])

    def test_upc(self):
        self.assertEqual(c.extract_upcs("UPC Code 810002862779."), ["810002862779"])

    def test_no_batch_model(self):
        self.assertEqual(c.extract_explicit_models("Batch code 202604 applies."), [])

    def test_model_colon(self):
        self.assertEqual(c.extract_explicit_models("X-Dream (model: 3570): Batches 10/24"), ["3570"])

    def test_singular_model(self):
        self.assertEqual(c.extract_explicit_models("fan kits are model CF10N1 made for ceilings."), ["CF10N1"])


class MatchingTests(unittest.TestCase):
    def setUp(self):
        self.records = [rec("Gourmia", "with model number GTF7530, and UPC Code 810002862779. The Model number GTF7530 and codes 3021 to 0126 can be found.")]

    def test_exact_model(self):
        x = c.candidates(self.records, [item("Gourmia", "GTF7530")])[0]
        self.assertEqual(x["status"], "MODEL_CANDIDATE_REVIEW_ONLY")

    def test_substring_does_not_match(self):
        self.assertEqual(c.candidates(self.records, [item("Gourmia", "GTF7530-Z")])[0]["status"], "NO_MATCH_IN_THIS_PARTIAL_FEED")

    def test_different_brand_does_not_match(self):
        self.assertEqual(c.candidates(self.records, [item("Other Brand", "GTF7530")])[0]["status"], "NO_MATCH_IN_THIS_PARTIAL_FEED")

    def test_upc_conflict(self):
        x = c.candidates(self.records, [item("Gourmia", "GTF7530", "000000000000")])[0]
        self.assertEqual(x["reason"], "EXPLICIT_MODEL_BUT_UPC_CONFLICT")

    def test_correct_upc(self):
        x = c.candidates(self.records, [item("Gourmia", "GTF7530", "810002862779")])[0]
        self.assertEqual(x["reason"], "EXPLICIT_MODEL_IN_DESCRIPTION")

    def test_missing_brand(self):
        self.assertEqual(c.candidates(self.records, [item("", "GTF7530")])[0]["status"], "INPUT_INCOMPLETE")

    def test_bose_speaker_not_battery_confirmed(self):
        r = [rec("Bose", "Battery packs for Bose S1 Pro. Serial number must be checked.", title="Bose Recalls Lithium-Ion Battery Packs for S1 Pro")]
        self.assertNotEqual(c.candidates(r, [item("Bose", "S1 Pro")])[0]["status"], "MODEL_CANDIDATE_REVIEW_ONLY")

    def test_ladder_name_only(self):
        r = [rec("Little Giant", "Only ladders without orange QC stickers qualify.", title="Little Giant Recalls ladders with Rapid Locks")]
        self.assertEqual(c.candidates(r, [item("Little Giant", "Rapid Locks")])[0]["status"], "NAME_CANDIDATE_REVIEW_ONLY")

    def test_no_match_not_safe_claim(self):
        self.assertIn("NOT a product safety clearance", c.candidates(self.records, [item("Other", "ZX9")])[0]["reason"])

    def test_normalization(self):
        self.assertEqual(c.norm("GTF-7530"), "GTF7530")


if __name__ == "__main__":
    unittest.main(verbosity=2)
