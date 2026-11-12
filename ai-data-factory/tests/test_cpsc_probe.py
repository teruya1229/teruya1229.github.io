import datetime as dt
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock
import urllib.error

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import cpsc_probe as P

START = dt.date(2026, 11, 1)
END = dt.date(2026, 11, 12)


def recall(rid=107001, published="2026-11-05T12:00:00", source="https://www.cpsc.gov/Recalls/2027/TEST", model="B-101"):
    return {
        "RecallID": rid,
        "RecallNumber": "27123",
        "RecallDate": "2026-11-05T00:00:00",
        "LastPublishDate": published,
        "Title": "Synthetic recall, testing only",
        "URL": source,
        "Products": [{"Name": "Synthetic sample", "Model": model}],
    }


class DateAndEndpointTests(unittest.TestCase):
    def test_dates(self):
        self.assertEqual(P.parse_day("2026-11-05"), dt.date(2026, 11, 5))
        self.assertEqual(P.date_from_api("2026-11-05T12:00:00"), "2026-11-05")
        self.assertIsNone(P.date_from_api("2026-13-13"))

    def test_invalid_date(self):
        with self.assertRaises(ValueError):
            P.parse_day("2026-11-05-blah")

    def test_endpoint_allow_list(self):
        uri = P.endpoint(START, END)
        self.assertEqual(uri.split("?")[0], P.API)
        self.assertIn("LastPublishDateStart=2026-11-01", uri)
        self.assertIn("LastPublishDateEnd=2026-11-12", uri)
        self.assertIn("format=json", uri)

    def test_max_window(self):
        with self.assertRaises(ValueError):
            P.endpoint(START, dt.date(2026, 12, 8))

    def test_future_or_bad_order(self):
        with self.assertRaises(ValueError):
            P.endpoint(END, START)

    def test_source_validation(self):
        self.assertTrue(P.official_url("https://www.cpsc.gov/Recalls/2027/Some-Product"))
        self.assertFalse(P.official_url("http://www.cpsc.gov/Recalls/2027/Some-Product"))
        self.assertFalse(P.official_url("https://cpsc.gov.attacker.test/Recalls/2027/Some-Product"))
        self.assertFalse(P.official_url("https://www.cpsc.gov@evil.test/Recalls/2027/Some-Product"))
        self.assertFalse(P.official_url("https://www.cpsc.gov:8080/Recalls/2027/Some-Product"))
        self.assertFalse(P.official_url("javascript:alert(1)"))

    def test_cross_site_redirect_refused(self):
        handler = P.OfficialOnlyRedirect()
        fake_req = mock.Mock()
        for uri in ["http://www.saferproducts.gov/RestWebServices/Recall", "https://evil.test/RestWebServices/Recall", "https://www.saferproducts.gov/private"]:
            with self.assertRaises(ValueError):
                handler.redirect_request(fake_req, None, 302, "Redirect", {}, uri)

    def test_fetched_url_cannot_be_changed(self):
        with self.assertRaises(ValueError):
            P.fetch_live("https://127.0.0.1/admin", timeout=1)


class PayloadTests(unittest.TestCase):
    def test_good_report_from_mock(self):
        quality, sample = P.inspect(json.dumps([recall()]).encode(), START, END)
        self.assertEqual(quality["quality_status"], "PASS")
        self.assertEqual(quality["unique_valid_recall_ids"], 1)
        self.assertFalse(sample[0]["automatic_inventory_matching"])
        self.assertEqual(sample[0]["review_status"], "unreviewed")

    def test_model_missing_not_guessed(self):
        quality, sample = P.inspect(json.dumps([recall(model="")]).encode(), START, END)
        self.assertEqual(quality["missing_explicit_model_count"], 1)
        self.assertEqual(sample[0]["models_in_explicit_field"], [])

    def test_out_of_window_flag(self):
        quality, _ = P.inspect(json.dumps([recall(published="2025-01-05T00:00:00")]).encode(), START, END)
        self.assertEqual(quality["quality_status"], "REVIEW_REQUIRED")
        self.assertTrue(any("outside_window" in x for x in quality["issues"]))

    def test_duplicate_flag(self):
        quality, _ = P.inspect(json.dumps([recall(), recall()]).encode(), START, END)
        self.assertIn("duplicate_recall_ids", quality["issues"])

    def test_untrusted_url_flag(self):
        quality, sample = P.inspect(json.dumps([recall(source="https://attacker.test/Recalls/123")]).encode(), START, END)
        self.assertEqual(quality["quality_status"], "REVIEW_REQUIRED")
        self.assertIsNone(sample[0]["source_url"])

    def test_empty_requires_review(self):
        quality, _ = P.inspect(b"[]", START, END)
        self.assertEqual(quality["quality_status"], "REVIEW_REQUIRED")

    def test_http200_error_object_rejected(self):
        with self.assertRaises(ValueError):
            P.inspect(b'{"error":"The parameter is invalid"}', START, END)

    def test_malformed_json_rejected(self):
        with self.assertRaises(ValueError):
            P.inspect(b"<html>HTTP 200 but not JSON</html>", START, END)

    def test_excessive_feed_rejected(self):
        with self.assertRaises(ValueError):
            P.inspect(json.dumps([recall()] * (P.MAX_ROWS + 1)).encode(), START, END)

    def test_bool_id_is_invalid(self):
        quality, _ = P.inspect(json.dumps([recall(rid=True)]).encode(), START, END)
        self.assertEqual(quality["quality_status"], "REVIEW_REQUIRED")

    def test_markup_is_data_only_and_never_marked_for_matching(self):
        record = recall()
        record["Title"] = "</script><script>steal()</script>"
        quality, sample = P.inspect(json.dumps([record]).encode(), START, END)
        self.assertEqual(quality["quality_status"], "PASS")
        self.assertFalse(sample[0]["automatic_inventory_matching"])
        self.assertIsInstance(sample[0]["title"], str)
        self.assertEqual(sample[0]["title"], "</script><script>steal()</script>")


class RunTests(unittest.TestCase):
    def test_success_proof_is_labeled_live_only_if_transport_returns_payload(self):
        with tempfile.TemporaryDirectory() as folder:
            raw = json.dumps([recall()]).encode()
            transport = lambda url: (raw, {
                "http_status": 200, "bytes": len(raw), "sha256": "a" * 64,
                "content_type": "application/json", "final_host": P.API_HOST,
            })
            data = P.run(START, END, Path(folder), transport)
            self.assertEqual(data["transport_status"], "HTTP_OK")
            self.assertEqual(data["quality_status"], "PASS")
            self.assertTrue((Path(folder) / "sample_review_only.json").exists())
            self.assertFalse(data["inventory_matching_enabled"])

    def test_failure_does_not_claim_api_success(self):
        with tempfile.TemporaryDirectory() as folder:
            def refusal(url):
                raise urllib.error.URLError("simulated network refusal")
            data = P.run(START, END, Path(folder), refusal)
            self.assertEqual(data["transport_status"], "NOT_FETCHED")
            self.assertEqual(data["quality_status"], "NOT_VERIFIED")
            self.assertEqual(json.loads((Path(folder) / "sample_review_only.json").read_text())["records"], [])

    def test_quality_failure_does_not_claim_pass(self):
        with tempfile.TemporaryDirectory() as folder:
            data = P.run(START, END, Path(folder), lambda url: (b"[]", {"http_status": 200}))
            self.assertEqual(data["transport_status"], "HTTP_OK")
            self.assertEqual(data["quality_status"], "REVIEW_REQUIRED")


if __name__ == "__main__":
    unittest.main(verbosity=2)
