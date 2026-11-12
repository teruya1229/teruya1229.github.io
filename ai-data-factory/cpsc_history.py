#!/usr/bin/env python3
"""One bounded full-history CPSC API GET; artifacts are review-only, not verdicts."""
from __future__ import annotations
import argparse
from collections import Counter
import datetime as dt
import gzip
import hashlib
import json
from pathlib import Path
import random
import ssl
import sys
import urllib.parse
import urllib.request
import cpsc_condition_extractor as extractor

API='https://www.saferproducts.gov/RestWebServices/Recall?format=json'
MAX_BYTES=48*1024*1024
MAX_ROWS=15000
MAX_DESCRIPTION=12000

def parse_date(value):
    if not isinstance(value,str) or len(value)<10: return None
    try: return dt.date.fromisoformat(value[:10]).isoformat()
    except ValueError: return None

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,url):
        u=urllib.parse.urlsplit(url)
        if (u.scheme!='https' or u.hostname!='www.saferproducts.gov' or
            u.path.lower()!='/restwebservices/recall' or u.username or u.password or u.port):
            raise ValueError('Disallowed CPSC API redirect')
        return super().redirect_request(req,fp,code,msg,headers,url)

def fetch():
    opener=urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),SafeRedirect())
    request=urllib.request.Request(API,headers={
        'Accept':'application/json',
        'User-Agent':'BCService-DataFactory-BackfillProof/0.1 (one read-only public request)'})
    with opener.open(request,timeout=70) as response:
        final=urllib.parse.urlsplit(response.geturl())
        if response.status!=200 or final.scheme!='https' or final.hostname!='www.saferproducts.gov' or final.path.lower()!='/restwebservices/recall':
            raise ValueError('Unexpected response status or destination')
        body=response.read(MAX_BYTES+1)
        if len(body)>MAX_BYTES:raise ValueError('Response exceeds 48 MiB bound')
        info={'http_status':response.status,'content_type':response.headers.get('Content-Type',''),
              'bytes':len(body),'raw_sha256':hashlib.sha256(body).hexdigest(),'final_host':final.hostname}
    return body,info

def normalize(body):
    records=json.loads(body.decode('utf-8-sig')) if isinstance(body,bytes) else body
    if not isinstance(records,list) or len(records)>MAX_ROWS:
        raise ValueError('Expected bounded JSON array')
    out=[];seen=set();quality=Counter();years=Counter()
    for record in records:
        if not isinstance(record,dict): quality['malformed']+=1;continue
        rid=record.get('RecallID')
        if not isinstance(rid,int) or isinstance(rid,bool) or rid<=0:
            quality['invalid_id']+=1;continue
        if rid in seen:quality['duplicate_id']+=1;continue
        seen.add(rid)
        if not extractor.official(record.get('URL')):
            quality['invalid_source_url']+=1;continue
        description=record.get('Description') or ''
        if not isinstance(description,str):description='';quality['invalid_description']+=1
        if len(description)>MAX_DESCRIPTION:quality['description_truncated']+=1
        date=parse_date(record.get('RecallDate'))
        publish=parse_date(record.get('LastPublishDate'))
        if not date:quality['missing_recall_date']+=1
        else:years[date[:4]]+=1
        if not publish:quality['missing_last_publish_date']+=1
        products=[]
        if isinstance(record.get('Products'),list):
            for p in record['Products'][:30]:
                if isinstance(p,dict):
                    products.append({key:p[key] for key in ('Name','Model') if isinstance(p.get(key),str)})
        else:quality['missing_products_array']+=1
        out.append({'RecallID':rid,'RecallNumber':str(record.get('RecallNumber') or '')[:80],
                    'RecallDate':date,'LastPublishDate':publish,'Title':str(record.get('Title') or '')[:500],
                    'Description':description[:MAX_DESCRIPTION],
                    'DescriptionSHA256':hashlib.sha256(description.encode('utf-8')).hexdigest(),
                    'DescriptionTruncated':len(description)>MAX_DESCRIPTION,
                    'Products':products,'URL':record['URL'],
                    'review_status':'UNREVIEWED_HISTORY','automatic_adjudication_enabled':False})
    out.sort(key=lambda r:r['RecallID'])
    quality['source_records']=len(records);quality['indexed_records']=len(out)
    return out,dict(quality),dict(sorted(years.items()))

def evaluate(records):
    metrics=Counter();groups={k:[] for k in ('pre2000','2000_2014','2015_2023','2024plus')}
    for r in records:
        p=extractor.propose(r)
        if not p:metrics['proposal_generation_skipped']+=1;continue
        codes=p['proposed_identifiers']
        has_model=bool(codes['model_tokens'] or codes['named_models'])
        metrics['proposals_total']+=1
        if has_model:metrics['with_model_proposal']+=1
        if codes['upc']:metrics['with_upc_proposal']+=1
        if codes['serial_prefixes']:metrics['with_serial_proposal']+=1
        if p['warnings']:metrics['with_warnings']+=1
        year=int((r.get('RecallDate') or '9999')[:4])
        group='pre2000' if year<2000 else '2000_2014' if year<2015 else '2015_2023' if year<2024 else '2024plus'
        groups[group].append({'recall_id':r['RecallID'],'recall_date':r['RecallDate'],
                             'title':r['Title'],'source_url':r['URL'],
                             'source_description_sha256':r['DescriptionSHA256'],
                             'proposed_identifiers':codes,'evidence_spans':p['evidence_spans'][:5],
                             'warnings':p['warnings'],'has_model_proposal':has_model,
                             'status':'UNREVIEWED_PROPOSAL','automatic_adjudication_enabled':False})
    rng=random.Random(20261112);sample=[]
    for name,items in groups.items():
        rng.shuffle(items)
        yes=[r for r in items if r['has_model_proposal']]
        no=[r for r in items if not r['has_model_proposal']]
        sample.extend([dict(r,sampling_bucket=name) for r in yes[:6]+no[:6]])
    return dict(metrics),{'review_only':True,'automatic_adjudication_enabled':False,
                          'selection':'Fixed-seed stratified by 4 time periods and model proposal',
                          'sample_count':len(sample),'records':sample}

def build(body,out,transport):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    data,stats,years=normalize(body)
    metrics,sample=evaluate(data)
    dates=[r['RecallDate'] for r in data if r['RecallDate']]
    oldest=min(dates) if dates else None
    newest=max(dates) if dates else None
    today=dt.datetime.now(dt.timezone.utc).date()
    age=(today-dt.date.fromisoformat(newest)).days if newest else 99999
    plausible=stats['indexed_records']>=5000 and bool(oldest and oldest<'1977-01-01') and age<=365 and stats.get('duplicate_id',0)==0
    destination=out/'historical_index_review_only.jsonl.gz'
    with destination.open('wb') as stream:
        with gzip.GzipFile(filename='',mode='wb',fileobj=stream,mtime=0) as zipped:
            for item in data:
                zipped.write((json.dumps(item,ensure_ascii=False,sort_keys=True)+'\n').encode('utf-8'))
    report={'schema_version':1,'source':API,'run_at_utc':dt.datetime.now(dt.timezone.utc).isoformat(),
            'retrieval':transport,'history_coverage_status':'PLAUSIBLE_NOT_COMPLETE_CERTIFICATION' if plausible else 'REVIEW_REQUIRED',
            'first_recall_date':oldest,'last_recall_date':newest,'year_counts':years,'quality_counts':stats,
            'extractor_metrics':metrics,'review_sample_count':sample['sample_count'],
            'candidate_accuracy':'NOT_MEASURED: labeled reviews required',
            'safety_clearance':False,'automated_rule_promotion':False,
            'persisted_in_business_database':False,
            'storage':'GitHub Actions artifact is temporary, not a long-term database',
            'index_gzip_sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),
            'index_gzip_bytes':destination.stat().st_size}
    (out/'history_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    (out/'review_sample_unapproved.json').write_text(json.dumps(sample,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    return report

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--output',required=True)
    p.add_argument('--fixture',help='Local test; no network')
    args=p.parse_args()
    if args.fixture:
        body=Path(args.fixture).read_bytes();transport={'fixture_only':True}
    else:
        body,transport=fetch()
    result=build(body,args.output,transport)
    print(json.dumps({'coverage':result['history_coverage_status'],
                      'source_count':result['quality_counts']['source_records'],
                      'indexed_count':result['quality_counts']['indexed_records'],
                      'earliest':result['first_recall_date'],'latest':result['last_recall_date'],
                      'models_proposed':result['extractor_metrics'].get('with_model_proposal',0),
                      'review_sample':result['review_sample_count'],
                      'accuracy':result['candidate_accuracy'],'sha256':result['index_gzip_sha256']},sort_keys=True))
    return 0 if args.fixture or result['history_coverage_status']=='PLAUSIBLE_NOT_COMPLETE_CERTIFICATION' else 3

if __name__=='__main__':sys.exit(main())
