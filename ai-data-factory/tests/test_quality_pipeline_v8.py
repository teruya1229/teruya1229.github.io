from pathlib import Path
import gzip,hashlib,json,sys,tempfile,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import quality_backfill_v8 as q

def record(id,desc):
 return {'RecallID':id,'RecallDate':'2020-07-02','LastPublishDate':'2020-07-02',
    'Title':'Test','URL':'https://www.cpsc.gov/Recalls/2020/Test',
    'Description':desc,'DescriptionSHA256':hashlib.sha256(desc.encode()).hexdigest(),
    'DescriptionTruncated':False}

class PipelineTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.root=Path(self.tmp.name);self.source=self.root/'input.gz';self.dest=self.root/'results'
  data=[record(1,'Year Model Numbers 2018 A18YAP20A8, A18YAP20N8 2019 A19YAP20A4'),
        record(2,'Brand Model Number Begins With Serial Number Begins With GE AHK30LK, AHW30LK AM1, DM1'),
        record(3,'Some unrelated notification with no model field')]
  with gzip.open(self.source,'wt',encoding='utf8') as f:
   for x in data:f.write(json.dumps(x)+'\n')
 def test_report_counts_and_no_auto_verdict(self):
  v=q.build(self.source,self.dest)
  self.assertEqual(v['counts']['source_records'],3)
  self.assertEqual(v['counts']['complex_table_notices'],2)
  self.assertEqual(v['counts']['typed_model_tokens'],3)
  self.assertFalse(v['automatic_adjudication_enabled'])
  self.assertEqual(v['candidate_precision'],'NOT_MEASURED_INDEPENDENTLY')
  with gzip.open(self.dest/'table_review_queue_v8.jsonl.gz','rt',encoding='utf8') as f:rows=[json.loads(line) for line in f]
  self.assertEqual(len(rows),2)
  self.assertTrue(all(not r['automatic_adjudication_enabled'] and not r['is_safety_clearance'] for r in rows))
 def test_output_deterministic(self):
  a=q.build(self.source,self.root/'a')
  b=q.build(self.source,self.root/'b')
  self.assertEqual(a['queue_sha256'],b['queue_sha256'])
 def test_preserves_original_source(self):
  original=self.source.read_bytes()
  q.build(self.source,self.dest)
  self.assertEqual(self.source.read_bytes(),original)

if __name__=='__main__':unittest.main(verbosity=2)