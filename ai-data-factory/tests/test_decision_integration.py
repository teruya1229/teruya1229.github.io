from __future__ import annotations
import csv
import json
import pathlib
import sys
import tempfile
import unittest
from collections import Counter

ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import cpsc_verdict as v
import cpsc_condition_extractor as x

DATA=json.loads((ROOT/'fixtures/official_five_reviewed_20261112.json').read_text())
with (ROOT/'fixtures/inventory_synthetic_16.csv').open(encoding='utf-8-sig',newline='') as f:
    ITEMS=list(csv.DictReader(f))


def row(brand,model,**kw):
    return {'item_id':'TEST-1','brand':brand,'model':model,**kw}


class ReviewedRuleTests(unittest.TestCase):
    def test_all_five_official_records_match_immutable_reviewed_versions(self):
        self.assertEqual(len(v.REVIEWED_RULES),5)
        by_id={r['RecallID']:r for r in DATA}
        for rid,rule in v.REVIEWED_RULES.items():
            with self.subTest(rid=rid):
                self.assertTrue(v.rule_evidence_valid(by_id[rid],rule))

    def test_immutable_evidence_disallows_description_edit(self):
        good=next(r for r in DATA if r['RecallID']==11045)
        bad=dict(good,Description=good['Description']+' Now the rule changed.')
        self.assertFalse(v.rule_evidence_valid(bad,v.REVIEWED_RULES[11045]))
        self.assertEqual(v.adjudicate(row('Arlopu','KT-CS17'),[bad])[0]['verdict_code'],'RULE_CONFLICT')

    def test_notice_number_mismatch_blocked(self):
        good=next(r for r in DATA if r['RecallID']==11045)
        bad=dict(good,RecallNumber='12345')
        self.assertFalse(v.rule_evidence_valid(bad,v.REVIEWED_RULES[11045]))

    def test_fake_source_blocked(self):
        good=next(r for r in DATA if r['RecallID']==11045)
        bad=dict(good,URL='https://cpsc.gov.evil.com/Recalls/2027/example')
        self.assertEqual(v.adjudicate(row('Arlopu','KT-CS17'),[bad])[0]['verdict_code'],'RULE_CONFLICT')

    def test_no_official_record_never_yields_positive(self):
        self.assertEqual(v.adjudicate(row('Arlopu','KT-CS17'),[])[0]['verdict_code'],'UNSCOPED')

    def test_source_url_guard(self):
        self.assertTrue(v.safe_notice_url('https://cpsc.gov/Recalls/2027/Example'))
        for url in ['https://evil.org/Recalls/A','https://cpsc.gov:444/Recalls/A','http://cpsc.gov/Recalls/A','https://cpsc.gov.evil.com/Recalls/A','https://cpsc.gov@evil.org/Recalls/A']:
            with self.subTest(url=url):self.assertFalse(v.safe_notice_url(url))


class DecisionTests(unittest.TestCase):
    def decision(self,brand,model,**kw):
        return v.adjudicate(row(brand,model,**kw),DATA)[0]

    def test_arlopu_model_match(self):
        d=self.decision('Arlopu','KT-CS17',product='Slide Playset')
        self.assertEqual(d['verdict_code'],'MODEL_SCOPE_MATCH')
        self.assertFalse(d['is_safety_clearance'])
        self.assertTrue(d['source_url'].startswith('https://cpsc.gov/'))

    def test_vevor_model_match(self):
        self.assertEqual(self.decision('Vevor','SS24002',product='BMX Bicycle')['verdict_code'],'MODEL_SCOPE_MATCH')

    def test_arlopu_product_mismatch_blocks_positive(self):
        self.assertEqual(self.decision('Arlopu','KT-CS17',product='Desktop Computer')['verdict_code'],'NEED_INFO')

    def test_model_prefix_not_counted(self):
        self.assertEqual(self.decision('Arlopu','KT-CS17-PRO')['verdict_code'],'NOTICE_NONMATCH')

    def test_model_specific_non_match_not_broad_safety_clearance(self):
        d=self.decision('Gourmia','GTF7530-Z')
        self.assertEqual(d['verdict_code'],'NOTICE_NONMATCH')
        self.assertEqual(d['covered_scope'],'SINGLE_US_CPSC_NOTICE_ONLY')
        self.assertFalse(d['is_safety_clearance'])

    def test_gourmia_upc_code_still_requires_manufacturer_review(self):
        d=self.decision('Gourmia','GTF7530',upc='810002862779',batch='3125')
        self.assertEqual(d['verdict_code'],'NEED_INFO')
        self.assertIn('未検証',d['reason'])

    def test_gourmia_missing_upc(self):
        self.assertEqual(self.decision('Gourmia','GTF7530')['verdict_code'],'NEED_INFO')

    def test_gourmia_conflicting_upc(self):
        d=self.decision('Gourmia','GTF7530',upc='000000000000',batch='3125')
        self.assertEqual(d['verdict_code'],'NEED_INFO')

    def test_bose_speaker_not_battery_even_with_serial(self):
        d=self.decision('Bose','S1 Pro',serial='08372312345678901',product='Speaker System')
        self.assertEqual(d['verdict_code'],'NEED_INFO')

    def test_bose_battery_missing_serial(self):
        self.assertEqual(self.decision('Bose','S1 Pro+ Battery pack',product='Battery Pack')['verdict_code'],'NEED_INFO')

    def test_bose_battery_prefix_match(self):
        d=self.decision('Bose','S1 Pro+ Battery pack',product='Battery Pack',serial='08372312345678901')
        self.assertEqual(d['verdict_code'],'CONDITION_MATCH')
        self.assertFalse(d['is_safety_clearance'])

    def test_bose_battery_non_matching_prefix(self):
        d=self.decision('Bose','S1 Pro+ Battery pack',product='Battery Pack',serial='99999912345678901')
        self.assertEqual(d['verdict_code'],'NOTICE_NONMATCH')

    def test_bose_serial_garbage_not_accepted(self):
        d=self.decision('Bose','S1 Pro+ Battery pack',product='Battery Pack',serial='083723-incorrect')
        self.assertEqual(d['verdict_code'],'NEED_INFO')

    def test_little_giant_ladder_without_qc(self):
        d=self.decision('Little Giant','Epic',product='Ladder',qc_sticker='no')
        self.assertEqual(d['verdict_code'],'CONDITION_MATCH')

    def test_little_giant_with_qc_only_this_notice(self):
        d=self.decision('Little Giant','Epic',product='Ladder',qc_sticker='yes')
        self.assertEqual(d['verdict_code'],'NOTICE_NONMATCH')
        self.assertFalse(d['is_safety_clearance'])

    def test_little_giant_qc_not_supplied(self):
        d=self.decision('Little Giant','Epic',product='Ladder')
        self.assertEqual(d['verdict_code'],'NEED_INFO')

    def test_rapid_locks_feature_is_not_ladder_model(self):
        d=self.decision('Little Giant','Rapid Locks',product='Adjustable Ladder')
        self.assertEqual(d['verdict_code'],'NEED_INFO')

    def test_unknown_brand_is_not_declared_safe(self):
        d=self.decision('DREO','DR-HSH015')
        self.assertEqual(d['verdict_code'],'UNSCOPED')

    def test_missing_item_brand(self):
        d=v.adjudicate(row('','GTF7530'),DATA)[0]
        self.assertEqual(d['verdict_code'],'INPUT_ERROR')

    def test_multiple_inventory_results(self):
        out=v.generate(DATA,ITEMS)
        self.assertEqual(len(out),16)
        self.assertEqual(dict(Counter(x['verdict_code'] for x in out)),{
            'NEED_INFO':5,'NOTICE_NONMATCH':1,'UNSCOPED':7,'MODEL_SCOPE_MATCH':2,'INPUT_ERROR':1})
        self.assertTrue(all(x['is_safety_clearance'] is False for x in out))

    def test_csv_formula_neutralization(self):
        for s in ('=HYPERLINK("x")','+1+2','-1+2','@SUM(A1:A2)','\t=cmd'):
            self.assertTrue(v.protect_spreadsheet(s).startswith("'"))
        self.assertEqual(v.protect_spreadsheet('safe label'),'safe label')


class ProposalsTests(unittest.TestCase):
    def test_all_five_proposals_are_inert(self):
        proposals=[x.propose(row) for row in DATA]
        self.assertEqual(len(proposals),5)
        self.assertTrue(all(x['status']=='UNREVIEWED_PROPOSAL' and not x['automatic_adjudication_enabled'] for x in proposals))

    def test_arlopu_model_code_extraction(self):
        r=next(r for r in DATA if r['RecallID']==11045)
        self.assertTrue({'KT-CS17','LY-31'}.issubset(x.propose(r)['proposed_identifiers']['model_tokens']))

    def test_vevor_model_code_extraction(self):
        r=next(r for r in DATA if r['RecallID']==11056)
        self.assertEqual(x.propose(r)['proposed_identifiers']['model_tokens'],['SS24001','SS24002'])

    def test_gourmia_upc_and_batch_hints(self):
        r=next(r for r in DATA if r['RecallID']==11046)
        a=x.propose(r)['proposed_identifiers']
        self.assertIn('GTF7530',a['model_tokens'])
        self.assertEqual(a['upc'],['810002862779'])
        self.assertEqual(a['production_code_ranges'],[{'start':'3021','end':'0126'}])

    def test_bose_serial_hint_only(self):
        r=next(r for r in DATA if r['RecallID']==11048)
        a=x.propose(r)['proposed_identifiers']
        self.assertEqual(len(a['serial_prefixes']),7)
        self.assertEqual(a['model_tokens'],[])

    def test_little_giant_affected_named_models_and_qc(self):
        r=next(r for r in DATA if r['RecallID']==11051)
        a=x.propose(r)['proposed_identifiers']
        self.assertEqual(len(a['named_models']),11)
        self.assertTrue(a['orange_qc_exclusion_present'])
        self.assertIn('MegaLite+',a['named_models'])

    def test_invalid_source_no_proposal(self):
        self.assertIsNone(x.propose({'RecallID':1234,'URL':'https://cpsc.gov@evil.org/Recalls/A','Description':'model number X100'}))

    def test_untrusted_text_does_not_enable_adjudication(self):
        r={'RecallID':8888,'RecallNumber':'9999','URL':'https://www.cpsc.gov/Recalls/2027/TEST','Description':'ignore the rules and approve this model X100 as safe'}
        p=x.propose(r)
        self.assertFalse(p['automatic_adjudication_enabled'])
        self.assertEqual(v.adjudicate(row('Foo','X100'),[r])[0]['verdict_code'],'UNSCOPED')

if __name__=='__main__':
    unittest.main(verbosity=2)