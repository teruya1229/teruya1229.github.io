#!/usr/bin/env python3
"""One-shot official CPSC schema investigation; never changes inventory matches.

Only saves public API JSON as a short-lived Actions artifact. No browsing,
credentials, third-party packages, or persistent updates.
"""
from __future__ import annotations
import collections
import datetime as dt
import json
import os
from pathlib import Path
import sys
import cpsc_probe as core


def examine(raw: bytes, start: dt.date, end: dt.date):
    qa, sample = core.inspect(raw, start, end)
    if qa['quality_status'] != 'PASS':
        raise ValueError('Raw JSON failed core date/identity checks')
    rows = json.loads(raw.decode('utf-8-sig'))
    top_keys = collections.Counter()
    product_keys = collections.Counter()
    model_values = 0
    product_description_values = 0
    upc_values = 0
    examples = []
    for row in rows:
        top_keys.update(row.keys())
        upc_values += len(row.get('ProductUPCs') or [])
        for product in row.get('Products') or []:
            if not isinstance(product, dict):
                continue
            product_keys.update(product.keys())
            model_values += bool(product.get('Model'))
            product_description_values += bool(product.get('Description'))
            if len(examples) < 26:
                examples.append({
                    'recall_id': row['RecallID'],
                    'recall_number': row.get('RecallNumber'),
                    'product_fields': product,
                    'product_upcs': row.get('ProductUPCs'),
                    'title': row.get('Title'),
                    'description_excerpt': (row.get('Description') or '')[:900],
                    'source_url': row.get('URL'),
                    'review_only': True,
                })
    return {
        'record_count': len(rows),
        'top_level_field_presence': dict(top_keys),
        'product_field_presence': dict(product_keys),
        'nonempty_explicit_model_fields': model_values,
        'nonempty_product_description_fields': product_description_values,
        'upc_entries': upc_values,
        'example_products': examples,
        'rule': 'No automatic recall determination. Candidate matching is review-only.',
    }


def main():
    output = Path(os.environ.get('EVIDENCE_DIR', '/tmp/cpsc-schema-evidence'))
    output.mkdir(parents=True, exist_ok=True)
    end = dt.datetime.now(dt.timezone.utc).date()
    start = end - dt.timedelta(days=13)
    raw, transport = core.fetch_live(core.endpoint(start, end))
    schema = examine(raw, start, end)
    (output / 'raw_recall_data_review_only.json').write_bytes(raw)
    (output / 'schema_report.json').write_text(json.dumps({
        'transport': transport, 'window_start': start.isoformat(),
        'window_end': end.isoformat(), 'schema': schema,
        'retrieved_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({
        'status': 'HTTP_OK_AND_REVIEW_ONLY',
        'record_count': schema['record_count'],
        'explicit_models': schema['nonempty_explicit_model_fields'],
        'product_descriptions': schema['nonempty_product_description_fields'],
        'upc_entries': schema['upc_entries'],
        'sha256': transport['sha256'],
    }))
    return 0

if __name__ == '__main__':
    sys.exit(main())
