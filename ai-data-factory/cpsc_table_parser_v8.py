"""Read-only parsing of flattened CPSC notice tables into typed review candidates.

No extracted item is an approved model, a recall decision, or a safety clearance.
This module intentionally abstains when columns cannot be mapped unambiguously.
"""
from __future__ import annotations

import re

MAX_CHARS = 30000
MAX_ENTRIES = 160
SCHEMA = 'cpsc-table-candidates-v8'

YEAR_HEADER = re.compile(r'\b(?:model\s+year\s+model\s+number|year\s+model\s+numbers?)\b', re.I)
DATE_HEADER = re.compile(r'\bmodel\s+date\s+codes?\s+UPC\b', re.I)
NUMERIC_HEADER = re.compile(r'\b(?:following\s+)?model\s+numbers?\s*:\s*', re.I)
RETAILER_HEADER = re.compile(r'\bweb\s+retailer\s+style\s+numbers\b', re.I)
SERIAL_HEADER = re.compile(r'\b(?:serial\s+number\s+range|model\s+serial\s+number\s+range|model\s+numbers?\s*\(?begins\s+with\)?\s*serial\s+numbers?|model\s+and\s+serial\s+numbers?\s+are\s+listed)\b', re.I)
PREFIX_TABLE = re.compile(r'\bmodel\s+number\s+begins\s+with\s*:\s*(?P<model>[A-Z]{2,8}[A-Z0-9]{1,12})\s+serial\s+number\s+begins\s+with\s*:\s*', re.I)
PREFIX_MEMBER = re.compile(r'(?<![A-Za-z0-9])[A-Z]{2,3}(?![A-Za-z0-9])',re.I)
TABLE_END = re.compile(r'\b(?:Consumers?\s+should|Customers?\s+should|Consumers?\s+can|For\s+more\s+information|No\s+other\s+models?|The\s+recalled\s+products?\s+were\s+sold|The\s+recalled\s+(?:mowers|vehicles|steamers|washers)\s+were\s+sold|To\s+check\s+if)\b', re.I)
MODEL_TOKEN = r'[A-Z0-9]{3,22}(?:[-._+][A-Z0-9]{1,18}){0,3}'
YEAR_ROW = re.compile(r'\b(?P<year>(?:19|20)\d{2})\s+(?P<model>' + MODEL_TOKEN + r')(?![A-Z0-9])', re.I)
COMMA_MODEL = re.compile(r'\s*,\s*(?P<model>' + MODEL_TOKEN + r')(?![A-Z0-9])', re.I)
DATE_ROW = re.compile(r'(?<![A-Z0-9])(?P<model>[A-Z]{2,6}\d{2,6}[A-Z]?)\s+(?P<start>\d{3}[A-Z]{1,3})\s*-\s*(?P<end>\d{3}[A-Z]{1,3})\s+(?P<upc>\d\s+\d{5}\s+\d{5}\s+\d)(?!\d)', re.I)
LIST_MODEL = re.compile(r'(?<![A-Za-z0-9])([A-Za-z0-9]{3,22}(?:[-._+][A-Za-z0-9]{1,18}){0,6})(?![A-Za-z0-9])')
DIGITS_ONLY_YEAR = re.compile(r'(?:18|19|20)\d{2}')


def _stop(description: str, begin: int, limit: int) -> int:
    end = min(len(description), begin + limit)
    match = TABLE_END.search(description, begin, end)
    return match.start() if match else end


def _cell(description: str, role: str, value: str, start: int, end: int) -> dict:
    if description[start:end] != value:
        raise ValueError('Source span mismatch')
    return {'role': role, 'value': value, 'start': start, 'end': end}


def _row(description: str, kind: str, columns: list[dict], anchor: int, context: str) -> dict:
    first = min(c['start'] for c in columns)
    last = max(c['end'] for c in columns)
    return {
        'table_kind': kind,
        'cells': columns,
        'anchor_start': anchor,
        'evidence_excerpt': description[max(0, first - 50):min(len(description), last + 80)],
        'status': 'UNREVIEWED_TYPED_TABLE_CANDIDATE',
        'automatic_adjudication_enabled': False,
        'is_safety_clearance': False,
        'source_text_is_untrusted': True,
        'scope_notes': context,
    }


def extract(description: str) -> dict:
    """Extract ONLY visibly mapped, typed columns; abstain from flattened ambiguous tables."""
    if not isinstance(description, str):
        description = ''
    if len(description) > MAX_CHARS:
        return {'schema': SCHEMA, 'status': 'ABSTAIN_TOO_LONG', 'rows': [],
                'unresolved': [{'kind': 'LONG_DOCUMENT', 'reason': 'Manual review required'}],
                'automatic_adjudication_enabled': False}
    rows: list[dict] = []
    unresolved: list[dict] = []
    seen = set()

    # Year-column has an explicit header and repeated YEAR + alphanumeric model tokens.
    for header in YEAR_HEADER.finditer(description):
        begin = header.end()
        end = _stop(description, begin, 8500)
        n = 0
        for match in YEAR_ROW.finditer(description, begin, end):
            year = match.group('year')
            code = match.group('model')
            if (not any(c.isdigit() for c in code) or not any(c.isalpha() for c in code)
                    or DIGITS_ONLY_YEAR.fullmatch(code) or len(code) < 5):
                continue
            key = (match.start('model'), 'MODEL_IDENTIFIER')
            if key in seen:
                continue
            seen.add(key)
            rows.append(_row(description, 'YEAR_MODEL', [
                _cell(description, 'MODEL_YEAR', year, match.start('year'), match.end('year')),
                _cell(description, 'MODEL_IDENTIFIER', code, match.start('model'), match.end('model')),
            ], header.start(), 'Model code associated with printed model year; NOT VIN applicability'))
            n += 1
            # A comma-only continuation is still within the same model-year row.
            # Never treat words, free prose, or spaced numeric date codes as models.
            tail = match.end('model')
            while n < MAX_ENTRIES:
                continuation = COMMA_MODEL.match(description, tail, end)
                if continuation is None:
                    break
                extended = continuation.group('model')
                if not (any(c.isalpha() for c in extended) and
                        any(c.isdigit() for c in extended) and len(extended) >= 5):
                    break
                key2 = (continuation.start('model'), 'MODEL_IDENTIFIER')
                if key2 not in seen:
                    seen.add(key2)
                    rows.append(_row(description, 'YEAR_MODEL', [
                        _cell(description, 'MODEL_YEAR', year, match.start('year'), match.end('year')),
                        _cell(description, 'MODEL_IDENTIFIER', extended, continuation.start('model'), continuation.end('model')),
                    ], header.start(), 'Comma continuation with preceding printed model year; NOT VIN applicability'))
                    n += 1
                tail = continuation.end('model')
            if n >= MAX_ENTRIES:
                unresolved.append({'kind':'YEAR_MODEL','reason':'Row cap reached; possible unparsed rows'})
                break
        if not n:
            unresolved.append({'kind':'YEAR_MODEL','reason':'No trusted year/model column pair; manual review',
                               'start':header.start(), 'excerpt':description[header.start():header.start()+180]})

    # Flattened Model / Date Codes / UPC tables: never confuse date codes with model IDs.
    for header in DATE_HEADER.finditer(description):
        begin = header.end(); end = _stop(description,begin,1800)
        n = 0
        for match in DATE_ROW.finditer(description,begin,end):
            model_code = match.group('model')
            if DIGITS_ONLY_YEAR.fullmatch(model_code):
                continue
            code = match.group('model')
            upc_digits = re.sub(r'\s','',match.group('upc'))
            if len(upc_digits) != 12: continue
            key = (match.start('model'), 'MODEL_IDENTIFIER')
            if key in seen: continue
            seen.add(key)
            cells = [
                _cell(description,'MODEL_IDENTIFIER',code,match.start('model'),match.end('model')),
                _cell(description,'DATE_CODE_START',match.group('start'),match.start('start'),match.end('start')),
                _cell(description,'DATE_CODE_END',match.group('end'),match.start('end'),match.end('end')),
                _cell(description,'UPC_12',match.group('upc'),match.start('upc'),match.end('upc')),
            ]
            rows.append(_row(description,'MODEL_DATE_UPC',cells,header.start(),
                             'Date codes and UPC required; appearance/exclusion conditions must also be reviewed'))
            n += 1
            if n >= MAX_ENTRIES: break
        if not n:
            unresolved.append({'kind':'MODEL_DATE_UPC','reason':'No full model/date/UPC row recognized; manual review',
                               'start':header.start(), 'excerpt':description[header.start():header.start()+160]})

    # Explicit colon followed by a homogeneous numeric model list, terminating at prose.
    for header in NUMERIC_HEADER.finditer(description):
        begin=header.end();end=_stop(description,begin,1250)
        fragment=description[begin:end];n=0;cursor=0
        # An unlabeled extra numeric suffix may be part of a composite model.
        # Refuse to split such values into independently matching model numbers.
        if re.search(r'\b(?=[A-Z0-9]{4,}\b)(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]{4,}\s+\d{3}(?=\s*(?:[,;]|\band\b|\bor\b))',fragment,re.I):
            unresolved.append({'kind':'COMPOSITE_MODEL_LIST','reason':'Unlabeled multi-token model; cannot split safely',
                               'start':header.start(),'excerpt':description[header.start():header.start()+240]})
            continue
        for match in LIST_MODEL.finditer(fragment):
            code=match.group(1)
            if not any(ch.isdigit() for ch in code):
                continue  # skip 'and'/'or' while keeping the entire gap to be verified
            gap=fragment[cursor:match.start()]
            if not re.fullmatch(r'[\s,;/()]*?(?:(?:and|or)\s*)?', gap, re.I):
                break  # ordinary prose, brand names, and manufacturing details stop the list
            if DIGITS_ONLY_YEAR.fullmatch(code):
                break  # 4-digit year may require human review; never silently treat as model
            tail=fragment[match.end(1):]
            if tail.startswith(('-', '.', '_', '+', '/')) or re.match(r'\([A-Z]\)',tail,re.I):
                unresolved.append({'kind':'MODEL_LIST_PARTIAL_TOKEN',
                    'reason':'Unparsed suffix or letter-variant: no partial model output',
                    'start':begin+match.start(1),'excerpt':fragment[match.start(1):match.start(1)+130]})
                break
            start=begin+match.start(1);key=(code.upper(),'NUMERIC_MODEL_LIST')
            if key in seen:
                cursor=match.end()
                continue
            seen.add(key)
            rows.append(_row(description,'NUMERIC_MODEL_LIST',[
                _cell(description,'MODEL_IDENTIFIER',code,start,begin+match.end(1))
            ],header.start(),'Numeric identifiers explicitly introduced as model numbers; other conditions not evaluated'))
            cursor=match.end();n+=1
            if n>=MAX_ENTRIES:break
        if n==0:
            unresolved.append({'kind':'NUMERIC_MODEL_LIST','reason':'No homogeneous numeric list; manual review',
                               'start':header.start(),'excerpt':description[header.start():header.start()+200]})

    # A single explicitly labelled prefix pair: type prefixes separately, not as exact models.
    # Mapping to actual inventory serials remains unverified; no recall decision follows.
    for match in PREFIX_TABLE.finditer(description):
        model=match.group('model')
        cells=[_cell(description,'MODEL_PREFIX',model,match.start('model'),match.end('model'))]
        cursor=match.end()
        serials=0
        for token in PREFIX_MEMBER.finditer(description,cursor,min(len(description),cursor+400)):
            sep=description[cursor:token.start()]
            if not re.fullmatch(r'[\s,;]*?(?:and\s+)?',sep,re.I):
                break
            cells.append(_cell(description,'SERIAL_PREFIX',token.group(0),token.start(),token.end()))
            serials+=1; cursor=token.end()
            if serials>=80:break
        if serials>=2:
            rows.append(_row(description,'MODEL_SERIAL_PREFIX',cells,match.start(),
                'Model and serial PREFIXES only; physical label and prefix-to-product relationship require verification'))
        else:
            unresolved.append({'kind':'MODEL_SERIAL_PREFIX','reason':'Could not verify two serial prefix tokens',
                               'start':match.start(),'excerpt':description[match.start():match.start()+200]})

    # These tables can flatten several columns into one sentence. Preserve ambiguity.
    for header,kind in [(RETAILER_HEADER,'RETAILER_STYLE_TABLE'), (SERIAL_HEADER,'SERIAL_OR_PREFIX_TABLE')]:
        for match in header.finditer(description):
            unresolved.append({'kind':kind, 'reason':'Column mapping cannot be trusted from flattened text; no model inference',
                               'start':match.start(),'excerpt':description[match.start():match.start()+240]})
    # Deterministic ordering and source offsets support review and de-duplication.
    rows.sort(key=lambda r:(min(c['start'] for c in r['cells'] if c['role'] in ('MODEL_IDENTIFIER','MODEL_PREFIX')),r['table_kind']))
    return {'schema':SCHEMA,'status':'REVIEW_ONLY', 'rows':rows,'unresolved':unresolved,
            'automatic_adjudication_enabled':False,'is_safety_clearance':False}