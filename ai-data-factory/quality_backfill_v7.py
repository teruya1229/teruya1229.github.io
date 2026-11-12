"""Offline, inert quality queue from CPSC v6 historical JSONL.GZ.
Never activates new verdict rules. Outputs only under explicitly selected directory.
"""
from __future__ import annotations
import argparse
from collections import Counter
import gzip,hashlib,json
from pathlib import Path
import cpsc_model_v7 as m
import cpsc_model_triage_v7 as t

def build(source:Path,out:Path):
    out.mkdir(parents=True,exist_ok=True)
    stats=Counter();top=[]
    filename=out/'model_review_queue_v7.jsonl.gz'
    with gzip.open(source,'rt',encoding='utf-8') as src,filename.open('wb') as rawout:
        with gzip.GzipFile(filename='',mode='wb',fileobj=rawout,mtime=0) as archive:
            for line in src:
                rec=json.loads(line);desc=rec.get('Description') or ''
                ids=m.propose_models(desc);gate=t.triage(desc,len(ids))
                tables=t.table_review_candidates(desc,[i['value'] for i in ids]) if gate['complex_layout_flags'] else []
                report={'recall_id':rec['RecallID'],'notice_date':rec.get('RecallDate'),
                    'title':rec.get('Title'),'source_url':rec['URL'],
                    'source_description_sha256':rec.get('DescriptionSHA256'),
                    'model_proposals':ids,'possible_table_identifiers_unverified':tables,
                    'triage':gate,'review_state':'UNREVIEWED','automatic_adjudication_enabled':False}
                archive.write((json.dumps(report,ensure_ascii=False,sort_keys=True)+'\n').encode('utf-8'))
                stats['rows']+=1;stats['with_model_proposals']+=bool(ids)
                stats['model_token_total']+=len(ids);stats['priority_'+gate['priority']]+=1
                stats['complex_table_records']+=bool(gate['complex_layout_flags'])
                stats['conditional_records']+=bool(gate['additional_condition_flags'])
                stats['table_candidate_tokens_unverified']+=len(tables)
                stats['tables_with_tokens']+=bool(tables)
                if gate['priority']=='HIGH':
                    top.append({'recall_id':rec['RecallID'],'notice_date':rec.get('RecallDate'),
                        'title':(rec.get('Title') or '')[:170],
                        'source_url':rec['URL'],'source_description_sha256':rec.get('DescriptionSHA256'),
                        'model_proposals':ids,
                        'possible_table_identifiers_unverified':tables[:60],
                        'source_excerpt':desc[:1000],
                        'complex_layout_flags':gate['complex_layout_flags'],
                        'review_state':'UNREVIEWED','automatic_adjudication_enabled':False})
    top.sort(key=lambda x:(bool(x['model_proposals'] or x['possible_table_identifiers_unverified']),x.get('notice_date') or '',len(x['possible_table_identifiers_unverified'])),reverse=True)
    top=top[:100]
    data={'schema_version':7,'origin':'CPSC official historical JSONL/GZ',
        'source_history_archive_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'model_review_queue_sha256':hashlib.sha256(filename.read_bytes()).hexdigest(),
        'metrics':dict(stats),'priority_review_count':len(top),
        'verified_precision':'NOT_MEASURED','verdict_accuracy':'NOT_MEASURED',
        'human_review_required_for_rule_promotion':True,
        'automatic_adjudication_enabled':False,'not_full_coverage_proof':True,
        'source_fields_are_untrusted_data':True}
    (out/'model_quality_report_v7.json').write_text(json.dumps(data,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    (out/'priority_review_100_v7.json').write_text(json.dumps({'count':len(top),'records':top,'review_only':True,'no_rule_activation':True},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return data
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--history',required=True);p.add_argument('--out',required=True);a=p.parse_args()
    data=build(Path(a.history),Path(a.out))
    print(json.dumps({'metrics':data['metrics'],'priority_review_count':data['priority_review_count'],'automatic_adjudication_enabled':False},sort_keys=True))
