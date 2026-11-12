#!/usr/bin/env python3
"""Draft evidence-linked CPSC conditions; NEVER auto-activate these proposals.

Only official CPSC feed objects. A draft is a parsing hypothesis, not a rule.
No browsing, fetching, inference by LLM, or updates to the reviewed rule table.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

MODEL_CODE = re.compile(r'(?<!\w)(?:[A-Z]{1,7}[-_]?[A-Z0-9]{2,}|\d{4,8})(?!\w)',re.I)
MODEL_ANCHOR = re.compile(r'\b(?:with\s+)?model\s+numbers?\s+|\bmodels\s+|\b(?:the\s+)?affected\s+models\s+are\s+',re.I)
UPCS = re.compile(r'\bUPC\s*(?:Code|codes?|number)?\s*[:#]?\s*(\d{10,14})\b',re.I)
SERIAL_ANCHOR = re.compile(r'\bserial\s+number.{0,130}?\b(?:following\s+six\s+digits\s*:|begins?\s+with\s+(?:any\s+one\s+of\s+)?(?:the\s+following\s+)?(?:six\s+digits\s*:?))',re.I|re.S)
QC_ANCHOR = re.compile(r'Only.{0,130}?without\s+an?\s+orange.{0,100}?\bQC\b.{0,65}?sticker',re.I|re.S)
AFFECTED_MODELS = re.compile(r'\b(?:the\s+)?affected\s+models\s+are\s+(.+?)(?:\.(?=\s+[A-Z]|$)|$)',re.I|re.S)
PRODUCTION = re.compile(r'\b(?:production|manufacturing|date)?\s*codes?\s+(\d{4})\s+to\s+(\d{4})\b',re.I)


def official(url):
    try:
        p=urlsplit(url)
        return bool(p.scheme=='https' and p.hostname in ('www.cpsc.gov','cpsc.gov') and not p.username and not p.password and p.port is None and p.path.lower().startswith('/recalls/'))
    except (TypeError,ValueError):
        return False


def find_evidence(text,pattern,limit=12):
    return [{'start':m.start(),'end':m.end(),'quote':m.group(0)[:250]} for m in list(pattern.finditer(text))[:limit]]


def propose(record):
    if not isinstance(record,dict) or not isinstance(record.get('RecallID'),int) or not official(record.get('URL','')):
        return None
    desc=str(record.get('Description') or '')
    models=[]; snippets=[]
    for match in MODEL_ANCHOR.finditer(desc):
        fragment=re.split(r'[.;\n]',desc[match.end():match.end()+160],maxsplit=1)[0]
        fragment=re.split(r'\b(?:and\s+(?:codes?|UPC|serials?|batches)|codes?|UPC|serials?|batches|can\s+also|printed|is\s+printed|located)\b',fragment,maxsplit=1,flags=re.I)[0]
        for code in MODEL_CODE.findall(fragment):
            if not any(ch.isdigit() for ch in code):
                continue
            if code.upper() not in models:
                models.append(code.upper())
        snippets.append({'start':match.start(),'end':match.end()+len(fragment),'quote':desc[match.start():match.end()+len(fragment)][:260]})
    named_models=[]
    for group in AFFECTED_MODELS.finditer(desc):
        names=re.split(r'\s*,\s*|\s+and\s+',group.group(1).strip(),flags=re.I)
        named_models.extend([name.strip() for name in names if name.strip()])
        snippets.append({'start':group.start(),'end':group.end(),'quote':group.group(0)[:260]})
    serial_prefixes=[]
    for match in SERIAL_ANCHOR.finditer(desc):
        fragment=re.split(r'[.;\n]',desc[match.end():match.end()+190],maxsplit=1)[0]
        for code in re.findall(r'\b\d{6}\b',fragment):
            if code not in serial_prefixes:
                serial_prefixes.append(code)
        snippets.append({'start':match.start(),'end':match.end()+len(fragment),'quote':desc[match.start():match.end()+len(fragment)][:260]})
    qc=find_evidence(desc,QC_ANCHOR)
    production=find_evidence(desc,PRODUCTION)
    for e in qc+production:
        snippets.append(e)
    upcs=list(dict.fromkeys(UPCS.findall(desc)))
    if upcs:
        snippets.extend(find_evidence(desc,UPCS))
    risks=[]
    if re.search(r'\b(?:only|except|without|battery|serial|manufactur|batch|lot|date|VIN|sticker|codes?)\b',desc,re.I):
        risks.append('Additional notice conditions may exist outside extracted fields')
    if not models and not upcs and not serial_prefixes and not qc:
        risks.append('No automatable identifiers found')
    return {
        'recall_id':record['RecallID'],
        'recall_number':str(record.get('RecallNumber') or ''),
        'source_url':record['URL'],
        'source_description_sha256':hashlib.sha256(desc.encode('utf-8')).hexdigest(),
        'proposed_identifiers': {'model_tokens':models,'named_models':named_models,'upc':upcs,'serial_prefixes':serial_prefixes,
                                 'production_code_ranges':[{'start':m.group(1),'end':m.group(2)} for m in PRODUCTION.finditer(desc)],
                                 'orange_qc_exclusion_present':bool(qc)},
        'evidence_spans':snippets[:15],
        'warnings':risks,
        'status':'UNREVIEWED_PROPOSAL',
        'automatic_adjudication_enabled':False,
        'authorization':'NONE: human verification required for each new notice',
    }


def main():
    a=argparse.ArgumentParser(); a.add_argument('--raw',required=True); a.add_argument('--out',required=True)
    args=a.parse_args(); records=json.loads(Path(args.raw).read_text(encoding='utf-8-sig'))
    if not isinstance(records,list):raise ValueError('CPSC feed must be list')
    result=[r for x in records if (r:=propose(x)) is not None]
    output=Path(args.out);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps({'review_only':True,'automatic_adjudication_enabled':False,'count':len(result),'rules':result},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'proposals':len(result),'with_models':sum(bool(x['proposed_identifiers']['model_tokens']) for x in result),'with_serial_prefixes':sum(bool(x['proposed_identifiers']['serial_prefixes']) for x in result),'automatic_adjudication_enabled':False},sort_keys=True))

if __name__=='__main__': main()