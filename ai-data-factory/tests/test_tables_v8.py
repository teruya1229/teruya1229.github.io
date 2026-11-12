import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
import cpsc_table_parser_v8 as p

def models(s):
 r=p.extract(s)
 return [c['value'] for row in r['rows'] for c in row['cells'] if c['role']=='MODEL_IDENTIFIER']

class TableTests(unittest.TestCase):
 def test_year_and_model_paired(self):
  d='Year Model Numbers 2018 A18YAP20A8, A18YAP20N8 2019 A19YAP20A4 2020 A20YAP20A4'
  # First row explicitly year+code; comma continuation is review-only for now.
  self.assertEqual(models(d),['A18YAP20A8','A18YAP20N8','A19YAP20A4','A20YAP20A4'])
  self.assertEqual([r['cells'][0]['value'] for r in p.extract(d)['rows']],['2018','2018','2019','2020'])
 def test_model_year_header(self):
  d='Model Year Model Number Model Price 2014 A14DH57AA RANGER $ 7,000.00 2015 A15DH57AJ RANGER $ 9,000.00'
  self.assertEqual(models(d),['A14DH57AA','A15DH57AJ'])
 def test_year_no_header(self):
  self.assertEqual(models('Cars of 2014 A14DH57AA type have been sold.'),[])
 def test_reject_model_year_as_code(self):
  self.assertEqual(models('Year Model Numbers 2014 2015 2016'),[])
 def test_model_date_upc_columns(self):
  d='Model Date Codes UPC HGS011F 102ZJ - 210ZJ 0 50875 82840 7 HGS011S 104ZJ - 210ZJ 0 50875 82839 1'
  r=p.extract(d)
  self.assertEqual(models(d),['HGS011F','HGS011S'])
  self.assertEqual([c['role'] for c in r['rows'][0]['cells']],['MODEL_IDENTIFIER','DATE_CODE_START','DATE_CODE_END','UPC_12'])
  self.assertEqual(''.join(r['rows'][0]['cells'][-1]['value'].split()),'050875828407')
 def test_model_date_no_upc_abstains(self):
  r=p.extract('Model Date Codes UPC HGS011F 102ZJ - 210ZJ 000')
  self.assertEqual(len(r['rows']),0);self.assertTrue(r['unresolved'])
 def test_numeric_list(self):
  d='and one of the following model numbers: 10247 10250 10323 10324 Lawn-Boy dealers sold these mowers.'
  self.assertEqual(models(d),['10247','10250','10323','10324'])
 def test_long_hyphen_code_not_truncated(self):
  d='model numbers: DOW-136-0-34-XIN, DOW-136-0-26-XIN, DOW-136-0-40-XIN-3/4 and D-RE-PSC-12'
  r=p.extract(d)
  self.assertEqual(models(d)[:2],['DOW-136-0-34-XIN','DOW-136-0-26-XIN'])
  self.assertNotIn('DOW-136-0-40-XIN-3',models(d))
  self.assertTrue(any(x['kind']=='MODEL_LIST_PARTIAL_TOKEN' for x in r['unresolved']))
 def test_ambiguous_two_token_composite_abstains(self):
  d='model numbers: 37C55U 658, 37C57U 602, 37C72U 520'
  r=p.extract(d)
  self.assertEqual(models(d),[])
  self.assertTrue(any(x['kind']=='COMPOSITE_MODEL_LIST' for x in r['unresolved']))
 def test_parenthetical_letter_variant_abstains(self):
  d='model numbers: S05PL8DSD, S05PM8DS(A)(B), S05PN8DS'
  r=p.extract(d)
  self.assertEqual(models(d),['S05PL8DSD'])
  self.assertTrue(any(x['kind']=='MODEL_LIST_PARTIAL_TOKEN' for x in r['unresolved']))
 def test_numeric_year_abstains(self):
  self.assertEqual(models('one of the following model numbers: 1999 10250 10323'),[])
 def test_false_model_list_prose(self):
  self.assertEqual(models('model numbers: Brands and manufacturing dates only'),[])
 def test_serial_table_is_abstention(self):
  s='Brand Model Number Begins With Serial Number Begins With GE AZ41, AZ61 AT, DT, FT'
  r=p.extract(s)
  self.assertEqual(len(r['rows']),0)
  self.assertTrue(any(x['kind']=='SERIAL_OR_PREFIX_TABLE' for x in r['unresolved']))
 def test_separate_model_and_serial_prefix_columns(self):
  d='Brand GE Model Number Begins With: WBVH5 Serial Number Begins With: AM, AR, AS, AT, DM, ZS'
  r=p.extract(d)
  self.assertEqual(models(d),[])  # Prefix is not an exact model!
  groups=[row for row in r['rows'] if row['table_kind']=='MODEL_SERIAL_PREFIX']
  self.assertEqual(len(groups),1)
  self.assertEqual([c['role'] for c in groups[0]['cells']],['MODEL_PREFIX']+['SERIAL_PREFIX']*6)
  self.assertEqual(groups[0]['cells'][0]['value'],'WBVH5')
  self.assertEqual([c['value'] for c in groups[0]['cells'][1:]],['AM','AR','AS','AT','DM','ZS'])
  self.assertFalse(groups[0]['automatic_adjudication_enabled'])
 def test_prefix_without_serial_abstains(self):
  d='Model Number Begins With: WBVH5 Serial Number Begins With: None recorded'
  r=p.extract(d)
  self.assertEqual(len(r['rows']),0)
  self.assertTrue(r['unresolved'])
 def test_retailer_style_not_model(self):
  d='Web Retailer Style Numbers Garnet Hill Inc 066-TW, 066-DB, 066-QN'
  self.assertEqual(models(d),[])
  self.assertTrue(any(x['kind']=='RETAILER_STYLE_TABLE' for x in p.extract(d)['unresolved']))
 def test_offsets_exact(self):
  d='Year Model Numbers 2018 A18YAP20A8 2019 A19YAP20A4'
  for r in p.extract(d)['rows']:
   for c in r['cells']:
    self.assertEqual(d[c['start']:c['end']],c['value'])
 def test_no_activation(self):
  d='Model Date Codes UPC HGS011F 102ZJ - 210ZJ 0 50875 82840 7'
  r=p.extract(d)
  self.assertFalse(r['automatic_adjudication_enabled'])
  self.assertTrue(all(x['automatic_adjudication_enabled'] is False and x['is_safety_clearance'] is False for x in r['rows']))
 def test_untrusted_html_is_data(self):
  self.assertEqual(models('<script>attack()</script> Year Model Numbers 2018 A18YAP20A8'),['A18YAP20A8'])
 def test_overlong_is_abstained(self):
  r=p.extract('x'*(p.MAX_CHARS+1));self.assertEqual(r['status'],'ABSTAIN_TOO_LONG');self.assertEqual(r['rows'],[])

if __name__=='__main__':unittest.main()