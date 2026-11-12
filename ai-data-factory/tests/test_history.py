from __future__ import annotations
import datetime as dt
import gzip
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock
import cpsc_history as h

def fixture(id=3,date='1999-06-05',desc='Affected model numbers AB123 and AB124.'):
    return {'RecallID':id,'RecallNumber':'0123','Title':'Example',
            'URL':'https://www.cpsc.gov/Recalls/2000/Example',
            'RecallDate':date,'LastPublishDate':date,'Description':desc,
            'Products':[{'Name':'example','Model':''}]}

class HistoryTests(unittest.TestCase):
    def test_official_source(self):self.assertTrue(h.extractor.official(fixture()['URL']))
    def test_host_trap(self):self.assertFalse(h.extractor.official('https://cpsc.gov.attacker.test/Recalls/2026/A'))
    def test_bad_response(self):
        with self.assertRaises(ValueError):h.normalize({'error':'invalid'})
    def test_duplicates_counted(self):
        rows,q,years=h.normalize([fixture(),fixture()])
        self.assertEqual(q['duplicate_id'],1)
        self.assertEqual(len(rows),1)
    def test_invalid_ids(self):
        rows,q,y=h.normalize([fixture(id=True),fixture(id=0)])
        self.assertEqual(q['invalid_id'],2)
        self.assertEqual(len(rows),0)
    def test_missing_date(self):
        rows,q,y=h.normalize([fixture(date='error')])
        self.assertIsNone(rows[0]['RecallDate'])
    def test_truncated_description(self):
        rows,q,y=h.normalize([fixture(desc='x'*(h.MAX_DESCRIPTION+1))])
        self.assertTrue(rows[0]['DescriptionTruncated'])
    def test_inert_data(self):
        rows,q,y=h.normalize([fixture(desc='<script>alert(1)</script>')])
        self.assertIn('<script>',rows[0]['Description'])
        self.assertFalse(rows[0]['automatic_adjudication_enabled'])
    def test_sample_proposals_are_inert(self):
        rows,_,_=h.normalize([fixture(),fixture(id=4,date='2025-02-02')])
        metrics,s=h.evaluate(rows)
        self.assertTrue(all(not r['automatic_adjudication_enabled'] for r in s['records']))
    def test_redirect_escapes_blocked(self):
        for url in ['http://www.saferproducts.gov/RestWebServices/Recall',
                    'https://bad.test/RestWebServices/Recall',
                    'https://www.saferproducts.gov/private']:
            with self.assertRaises(ValueError):
                h.SafeRedirect().redirect_request(Mock(),None,302,'found',{},url)
    def test_gzip_roundtrip_and_no_clearance(self):
        with tempfile.TemporaryDirectory() as d:
            result=h.build(json.dumps([fixture()]).encode(),d,{'fixture_only':True})
            items=gzip.decompress((Path(d)/'historical_index_review_only.jsonl.gz').read_bytes()).decode()
            self.assertFalse(json.loads(items.splitlines()[0])['automatic_adjudication_enabled'])
            self.assertFalse(result['safety_clearance'])
            self.assertEqual(result['candidate_accuracy'],'NOT_MEASURED: labeled reviews required')
    def test_max_rows(self):
        with self.assertRaises(ValueError):h.normalize([fixture(i+1) for i in range(h.MAX_ROWS+1)])
    def test_invalid_source_skipped(self):
        row=fixture();row['URL']='https://evil.test/Recalls/2027/A'
        rows,q,y=h.normalize([row])
        self.assertEqual(len(rows),0)

if __name__=='__main__':unittest.main()
