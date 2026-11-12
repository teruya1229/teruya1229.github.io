#!/usr/bin/env python3
"""Fail CI when an automatic verdict pretends to certify product safety."""
import argparse,csv,json
from collections import Counter
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--verdicts',required=True);p.add_argument('--drafts',required=True);a=p.parse_args()
with open(a.verdicts,encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
proposals=json.loads(Path(a.drafts).read_text(encoding='utf-8'))
assert len(rows)==16,(len(rows),'expected synthetic fixtures 16 rows')
assert rows and all(r['is_safety_clearance']=='False' for r in rows)
assert proposals.get('automatic_adjudication_enabled') is False
assert proposals.get('review_only') is True
assert all(x.get('status')=='UNREVIEWED_PROPOSAL' and x.get('automatic_adjudication_enabled') is False for x in proposals['rules'])
print(json.dumps({'verdicts':len(rows),'counts':dict(Counter(r['verdict_code'] for r in rows)),'unreviewed_proposals':proposals['count'],'zero_safety_certifications':True},ensure_ascii=False,sort_keys=True))