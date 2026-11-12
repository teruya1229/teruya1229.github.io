#!/usr/bin/env python3
"""Review-only inventory candidate matching from official CPSC recall descriptions.

Never confirms a product is recalled or safe. No network, no credentials.
"""
from __future__ import annotations
import argparse
import csv
import json
from pathlib import Path
import re

MODEL = re.compile(r'(?<!\w)(?:[A-Z]{1,8}[-_]?[A-Z0-9]{2,}|[A-Z]{1,8}-\d{2,}|\d{4,8})(?!\w)', re.I)
ANCHOR = re.compile(r'(?:(?<!\w)model\s*(?:numbers?|nos?\.?|#)\b|(?<=,)\s*models\b|\(model:|\bmodel\s+(?=[A-Za-z]{1,4}[-_]?[0-9]))\s*(?::|are|include)?\s*', re.I)
STOP = re.compile(r'[.;\n]')
UPC = re.compile(r'\bUPC\s*(?:Code|codes?|number)?\s*[:#]?\s*(\d{10,14})\b', re.I)

def norm(value):
    return re.sub(r'[^A-Z0-9]', '', str(value or '').upper())

def extract_explicit_models(description):
    matches = []
    for m in ANCHOR.finditer(description or ''):
        frag = STOP.split(description[m.end():m.end() + 90], maxsplit=1)[0]
        frag = re.split(r'\b(?:and\s+(?:codes?|UPC|batches|serials?|dates)|codes?|UPC|batches|serials?|dated|on|printed|located|with|which|that|is|was|to|for|from|and\s+(?:has|is))\b', frag, maxsplit=1, flags=re.I)[0]
        for found in MODEL.finditer(frag):
            code = found.group(0).upper()
            if any(x.isdigit() for x in code) and code not in matches:
                matches.append(code)
    return matches

def extract_upcs(description):
    return list(dict.fromkeys(UPC.findall(description or '')))

def conservative_brand_matches(brand, record):
    b = str(brand or '').strip()
    if not b or len(b) < 2:
        return False
    base = ' '.join([record.get('Title') or ''] + [
        x.get('Name', '') for x in (record.get('Products') or []) if isinstance(x, dict)])
    return bool(re.search(r'(?<![\w])' + re.escape(b) + r'(?![\w])', base, re.I))

def candidates(records, inventory):
    results = []
    for line in inventory:
        item_id = line.get('item_id', '')
        brand = line.get('brand', '').strip()
        model = line.get('model', '').strip()
        if not item_id or not brand or not model:
            results.append({'item_id': item_id, 'brand': brand, 'model': model, 'status': 'INPUT_INCOMPLETE', 'recall_id': '', 'reason': 'brand/item_id/model required', 'source_url': ''})
            continue
        matches, ambiguous = [], []
        for record in records:
            if not conservative_brand_matches(brand, record):
                continue
            desc = record.get('Description') or ''
            codes = extract_explicit_models(desc)
            upcs = extract_upcs(desc)
            source = record.get('URL', '')
            if not isinstance(source, str) or not source.startswith('https://'):
                continue
            if norm(model) in {norm(code) for code in codes}:
                matches.append((record, 'EXPLICIT_MODEL_IN_DESCRIPTION', codes, upcs))
            else:
                title = (record.get('Title') or '').upper()
                if norm(model) in {norm(n.get('Name', '')) for n in (record.get('Products') or []) if isinstance(n, dict)}:
                    ambiguous.append((record, 'PRODUCT_NAME_ONLY', codes, upcs))
                elif model.upper() in title:
                    ambiguous.append((record, 'TITLE_ONLY', codes, upcs))
        if matches:
            for record, reason, codes, upcs in matches:
                upc = norm(line.get('upc', ''))
                if upc and upcs and upc not in {norm(x) for x in upcs}:
                    reason = 'EXPLICIT_MODEL_BUT_UPC_CONFLICT'
                results.append({'item_id': item_id, 'brand': brand, 'model': model, 'status': 'MODEL_CANDIDATE_REVIEW_ONLY', 'recall_id': record['RecallID'], 'recall_number': record.get('RecallNumber', ''), 'reason': reason, 'source_url': record['URL'], 'explicit_model_codes': '|'.join(codes), 'official_description_upcs': '|'.join(upcs)})
        elif ambiguous:
            for record, reason, codes, upcs in ambiguous:
                results.append({'item_id': item_id, 'brand': brand, 'model': model, 'status': 'NAME_CANDIDATE_REVIEW_ONLY', 'recall_id': record['RecallID'], 'recall_number': record.get('RecallNumber', ''), 'reason': reason, 'source_url': record['URL'], 'explicit_model_codes': '|'.join(codes), 'official_description_upcs': '|'.join(upcs)})
        else:
            results.append({'item_id': item_id, 'brand': brand, 'model': model, 'status': 'NO_MATCH_IN_THIS_PARTIAL_FEED', 'recall_id': '', 'reason': 'Partial date range and strict exact rules: NOT a product safety clearance', 'source_url': ''})
    return results

def cli():
    p = argparse.ArgumentParser()
    p.add_argument('--raw', required=True)
    p.add_argument('--inventory', required=True)
    p.add_argument('--out', required=True)
    args = p.parse_args()
    records = json.loads(Path(args.raw).read_text(encoding='utf-8-sig'))
    if not isinstance(records, list):
        raise ValueError('CPSC raw JSON must be a list')
    with open(args.inventory, encoding='utf-8-sig', newline='') as handle:
        inventory = list(csv.DictReader(handle))
    rows = candidates(records, inventory)
    fields = ['item_id', 'brand', 'model', 'status', 'recall_id', 'recall_number', 'reason', 'source_url', 'explicit_model_codes', 'official_description_upcs']
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('w', encoding='utf-8-sig', newline='') as handle:
        w = csv.DictWriter(handle, fieldnames=fields, extrasaction='ignore')
        w.writeheader()
        w.writerows(rows)
    print(json.dumps({'inventory_count': len(inventory), 'candidate_result_rows': len(rows), 'review_only': True, 'counts': {s: sum(r['status'] == s for r in rows) for s in sorted({r['status'] for r in rows})}}, ensure_ascii=False))

if __name__ == '__main__':
    cli()
