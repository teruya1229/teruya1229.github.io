"""One-time offline audit of historical CPSC flattened tables; review-only.

Input: existing CPSC v6 review-only history snapshot. No network and no writes to Git.
Output: short-lived evidence only; an unreviewed table hint is never an active rule.
"""
from __future__ import annotations
import argparse
from collections import Counter
import gzip,hashlib,json,random
from pathlib import Path
import cpsc_table_parser_v8 as table
import cpsc_model_triage_v7 as old_triage


def build(source: Path, output: Path) -> dict:
    output.mkdir(parents=True,exist_ok=True)
    stats=Counter();by_kind=Counter();unresolved_kind=Counter()
    sample_by_kind={k:[] for k in ('YEAR_MODEL','MODEL_DATE_UPC','NUMERIC_MODEL_LIST','MODEL_SERIAL_PREFIX','UNRESOLVED')}
    queue=output/'table_review_queue_v8.jsonl.gz'
    with gzip.open(source,'rt',encoding='utf-8') as stream, queue.open('wb') as file:
        with gzip.GzipFile(fileobj=file, mode='wb', filename='',mtime=0) as archive:
            for line in stream:
                record=json.loads(line)
                stats['source_records']+=1
                desc=record.get('Description') or ''
                triage=old_triage.triage(desc,0)
                if not triage['complex_layout_flags']:
                    continue
                stats['complex_table_notices']+=1
                proposed=table.extract(desc)
                if not proposed['automatic_adjudication_enabled']:
                    stats['no_rule_promotion']+=1
                else:raise ValueError('Unexpected active rule')
                entries=proposed['rows']
                stats['notices_with_typed_rows']+=bool(entries)
                stats['typed_model_tokens']+=sum(any(c['role']=='MODEL_IDENTIFIER' for c in r['cells']) for r in entries)
                stats['typed_prefix_groups']+=sum(r['table_kind']=='MODEL_SERIAL_PREFIX' for r in entries)
                stats['typed_serial_prefix_tokens']+=sum(c['role']=='SERIAL_PREFIX' for r in entries for c in r['cells'])
                stats['notices_abstained']+=not bool(entries)
                stats['source_truncated_notices']+=bool(record.get('DescriptionTruncated'))
                for entry in entries:
                    by_kind[entry['table_kind']]+=1
                    for cell in entry['cells']:
                        if desc[cell['start']:cell['end']]!=cell['value']:
                            raise ValueError(f"Bad evidence offsets {record['RecallID']}")
                        if cell['role']=='MODEL_IDENTIFIER' and cell['value'].isdigit() and len(cell['value'])==4 and cell['value'][:2] in ('18','19','20'):
                            raise ValueError('Manufacture year misclassified as model')
                    if entry['automatic_adjudication_enabled'] or entry['is_safety_clearance']:
                        raise ValueError('Unsafe verdict in candidate data')
                for pending in proposed['unresolved']:
                    unresolved_kind[pending['kind']]+=1
                payload={
                    'recall_id':record['RecallID'], 'recall_date':record.get('RecallDate'),
                    'source_url':record['URL'], 'title':record.get('Title'),
                    'source_description_sha256':record.get('DescriptionSHA256'),
                    'parser_schema':table.SCHEMA,
                    'source_truncated':bool(record.get('DescriptionTruncated')),
                    'table_patterns':triage['complex_layout_flags'],
                    'typed_rows':entries, 'unresolved':proposed['unresolved'],
                    'review_status':'PENDING_HUMAN_REVIEW',
                    'automatic_adjudication_enabled':False,
                    'is_safety_clearance':False,
                }
                archive.write((json.dumps(payload,ensure_ascii=False,sort_keys=True)+'\n').encode('utf-8'))
                tag=entries[0]['table_kind'] if entries else 'UNRESOLVED'
                sample_by_kind[tag].append(payload)
    # Fixed, documented seed: the review sample is representative by parser kind,
    # not a statistical population sample. It is not independent validation data.
    rng=random.Random(20261112)
    sample=[]
    for kind,entries in sample_by_kind.items():
        rng.shuffle(entries)
        sample.extend(entries[:12])
    sample.sort(key=lambda x:(str(x['recall_date']),x['recall_id']))
    report={
        'schema_version':8,'source_history_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'queue_sha256':hashlib.sha256(queue.read_bytes()).hexdigest(),
        'counts':dict(stats),'typed_column_counts':dict(by_kind),
        'unresolved_table_reason_counts':dict(unresolved_kind),
        'sample_count':len(sample),
        'candidate_precision':'NOT_MEASURED_INDEPENDENTLY',
        'model_recall':'NOT_MEASURED_INDEPENDENTLY',
        'recall_decision_accuracy':'NOT_MEASURED',
        'complete_recall_coverage':False,
        'all_rows_unreviewed':True,
        'automatic_adjudication_enabled':False,
        'no_match_is_not_safe':True,
        'meaning':'Typed identifiers and year/date/UPC are hints from flattened tables only',
    }
    (output/'table_quality_report_v8.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    (output/'table_review_sample_v8.json').write_text(json.dumps({'review_only':True,'records':sample},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return report


def main():
    p=argparse.ArgumentParser();p.add_argument('--history',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    q=build(Path(a.history),Path(a.output))
    print(json.dumps({'counts':q['counts'],'typed_column_counts':q['typed_column_counts'],
       'unresolved_table_reason_counts':q['unresolved_table_reason_counts'],
       'sample_count':q['sample_count'],'automatic_adjudication_enabled':False},ensure_ascii=False,sort_keys=True))

if __name__=='__main__':main()