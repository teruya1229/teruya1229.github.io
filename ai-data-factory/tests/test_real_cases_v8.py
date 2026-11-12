import json,pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
import cpsc_table_parser_v8 as p

RECORDS={v['RecallID']:v for v in json.loads((pathlib.Path(__file__).resolve().parents[1]/'fixtures/real_notices_14_v8.json').read_text())['notices']}

def models(data):
 return [c['value'] for row in data['rows'] for c in row['cells'] if c['role']=='MODEL_IDENTIFIER']

class RealNoticeTests(unittest.TestCase):
 def test_actual_numeric_model_list(self):
  v=p.extract(RECORDS[50]['Description'])
  self.assertEqual(models(v), ['10247','10250','10323','10324','10331','10332','10424','10425','10525','10527','10547','10548'])
 def test_actual_year_models(self):
  self.assertEqual(len(models(p.extract(RECORDS[7943]['Description']))),14)
  self.assertEqual(len(models(p.extract(RECORDS[7991]['Description']))),54)
  self.assertEqual(len(models(p.extract(RECORDS[8003]['Description']))),27)
  self.assertEqual(len(models(p.extract(RECORDS[8028]['Description']))),25)
  v=p.extract(RECORDS[8847]['Description'])
  self.assertEqual(models(v),['A18YAP20A8','A18YAP20N8','A19YAP20A4','A19YAP20N4','A20YAP20A4'])
 def test_actual_model_date_upc(self):
  v=p.extract(RECORDS[9443]['Description'])
  self.assertEqual(models(v),['HGS011F','HGS011S','HGS011'])
  for r in v['rows']:
   self.assertEqual({c['role'] for c in r['cells']},{'MODEL_IDENTIFIER','DATE_CODE_START','DATE_CODE_END','UPC_12'})
 def test_serial_and_retailer_tables_abstain(self):
  for i in (113,254,553,580,696,2804):
   with self.subTest(i=i):
    r=p.extract(RECORDS[i]['Description'])
    self.assertEqual(models(r),[])
 def test_complex_brand_table_abstains(self):
  self.assertEqual(models(p.extract(RECORDS[9]['Description'])),[])
 def test_every_span_grounded(self):
  for i,v in RECORDS.items():
   d=v['Description'];o=p.extract(d)
   for row in o['rows']:
    self.assertFalse(row['automatic_adjudication_enabled'])
    self.assertFalse(row['is_safety_clearance'])
    for c in row['cells']:
     self.assertEqual(d[c['start']:c['end']],c['value'])

if __name__=='__main__':unittest.main()