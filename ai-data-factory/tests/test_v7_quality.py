"""Regression tests for candidate-only CPSC v7 extractor and review gate."""
import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import cpsc_model_v7 as m
import cpsc_model_triage_v7 as t

class Extractor(unittest.TestCase):
    def test_years_not_models(self):
        self.assertEqual(m.proposals('All models purchased from 1988 through September 1993 are affected.'),[])
    def test_two_dotted_models(self):
        self.assertEqual(m.proposals('model number 831.14595.0 and model number RBBE1996.0.'),['831.14595.0','RBBE1996.0'])
    def test_hyphenated_model(self):
        self.assertEqual(m.proposals('model number 43398-68657.'),['43398-68657'])
    def test_old_list(self):
        self.assertEqual(m.proposals('Model numbers involved in the recall are: W96DK, W108DK, WB180K.'),['W96DK','W108DK','WB180K'])
    def test_old_ocr_ignored(self):
        self.assertEqual(m.proposals('Model PHT417.e The walkers were sold. Model PHT417 was also printed.'),['PHT417'])
    def test_no_false_brand(self):
        self.assertEqual(m.proposals('and HTP brand boilers in the EFTU model series.'),[])
    def test_model_and_batch_separate(self):
        self.assertEqual(m.proposals('model number WE11E5080Wx3-W or WE11E5081Rx3-W and batch number SME2025112805.'),['WE11E5080WX3-W','WE11E5081RX3-W'])
    def test_two_token(self):
        self.assertEqual(m.proposals('model number WWH 2052A. This is the only model affected.'),['WWH 2052A'])
    def test_not_safety_verdict(self):
        rows=m.propose_models('model number DR-HSH015.')
        self.assertEqual(rows[0]['review_status'],'UNREVIEWED_PROPOSAL')
        self.assertFalse(rows[0]['automatic_adjudication_enabled'])
    def test_original_evidence_offsets(self):
        d='A notice lists model number DR-HSH015 for review only.'
        rows=m.propose_models(d)
        self.assertEqual(d[rows[0]['start']:rows[0]['end']],'DR-HSH015')

class ReviewGate(unittest.TestCase):
    def test_table_flag(self):
        d='Year Model Numbers 2018 A18YAP20A8 2019 A19YAP20A4.'
        self.assertEqual(t.triage(d,0)['priority'],'HIGH')
        codes=[x['value'] for x in t.table_review_candidates(d)]
        self.assertEqual(codes,['A18YAP20A8','A19YAP20A4'])
    def test_long_list_review(self):
        d='The following model numbers found under the mattress: 8212 8222 8232.'
        self.assertEqual(t.triage(d,0)['priority'],'HIGH')
    def test_no_match_is_not_safe(self):
        x=t.triage('No model number is known.',0)
        self.assertTrue(x['no_match_does_not_mean_safe'])
        self.assertFalse(x['is_recall_status_decided'])
    def test_serial_requires_review(self):
        d='model DR-HSH015 with serial numbers in a restricted range.'
        x=t.triage(d,1)
        self.assertIn('SERIAL_CONDITION',x['additional_condition_flags'])
        self.assertEqual(x['priority'],'MEDIUM')
    def test_all_untrusted_table_codes_are_inert(self):
        d='Model Date Codes UPC HGS011F 102ZJ 210ZJ HGS011S 104ZJ'
        out=t.table_review_candidates(d)
        self.assertTrue(out)
        self.assertTrue(all(x['review_status']=='UNREVIEWED_TABLE_TOKEN' for x in out))
        self.assertTrue(all(x['automatic_adjudication_enabled'] is False for x in out))

if __name__=='__main__':unittest.main(verbosity=2)
