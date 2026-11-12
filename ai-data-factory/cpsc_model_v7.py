"""Conservative, evidence-linked model identifiers from recall descriptions.

Only proposes model strings explicitly adjacent to a model-designating phrase.
It never declares inventory safe or recalled, and never promotes any rule.
"""
from __future__ import annotations
import re

ANCHOR = re.compile(r'(?i)\b(?:model\s+numbers?|model\s+nos?\.?|model\s+series|model\s*#|models?|affected\s+models)\b')
TOKEN = re.compile(r'(?<![A-Za-z0-9])([A-Za-z0-9]{1,22}(?:[-._+][A-Za-z0-9]{1,22}){0,5})(?![A-Za-z0-9])')
SIZE_UNIT = re.compile(r"(?i)^\d{1,3}(?:cm|mm|inch|in)$")
PURE_ALPHA_MODEL = re.compile(r"^[A-Z]{3,6}$")
RESERVED = {"MODEL","MODELS","CODE","CODES","PART","PARTS","SKU","UPC","PO","ONLY","NONE","THE","AND","FOR","WITH","BATCH","DATE","YEAR","RECALL","SERIAL","NUMBER","NUMBERS","BRAND","SOLD","TYPE","UNIT","UNITS","VIN","CPSC","NEWS","START","COLORS","HTP"}
WORD_YEAR = re.compile(r'^(?:18|19|20)\d{2}$')
NOISE_LEADS = re.compile(r'(?i)^(?:year|years|are|is|include|includes|purchased|purchasing|sold|selling|from|between|through|dated|manufactured|manufacturing|made|for|that|which|of|with|sku|po|upc|serial|numbers?|name|names|located|printed|appears|have|has|may|in)\b')
STOP_START = re.compile(r'(?i)^(?:batch|lot|serial|production|manufacturing|manufacture|date|upc|sku|p[.]?o[.]?|order|located|printed|appears|are|is|has|have|made|made\s+by|sold|sold\s+by|recalled|affected|from|through|by|the\s+model|and\s+codes?)\b')
YEAR_CONTEXT = re.compile(r'(?i)\b(?:purchased|from|through|between|in\s+the\s+years?|manufactured|sold|selling|made|dated|model\s+year)\b')
MARKETING_QUOTED = re.compile(r'[“\"]([^\"”]{1,40})[”\"]')
CONJ_GAP = re.compile(r'(?i)^[\s,;:/()\[\]"“”]*(?:(?:and|or|&)[\s,;:/()\[\]"“”]*)?$')


def canon(code: str) -> str:
    return str(code).strip().upper()


def plausible(code: str, surrounding: str = '', allow_alpha_list_member: bool = False) -> bool:
    if len(code) < 2 or (not any(c.isdigit() for c in code) and not (re.fullmatch(r"[A-Z]{2,}(?:-[A-Z]{2,}){2,}", code) or (allow_alpha_list_member and PURE_ALPHA_MODEL.fullmatch(code) and code not in RESERVED))):
        return False
    if SIZE_UNIT.fullmatch(code):
        return False
    if code.isdigit() and len(code) < 3:
        return False
    if WORD_YEAR.fullmatch(code):
        return False
    return True


def _remove_marketing_quotes(fragment: str) -> str:
    # Preserve quoted identifier such as "T186". Strip quoted descriptions such as "Power X".
    return MARKETING_QUOTED.sub(lambda m: m.group(0) if any(x.isdigit() for x in m.group(1)) else ' '*len(m.group(0)), fragment)


def propose_models(description: str) -> list[dict]:
    """Return stable, unapproved model candidates with supporting exact substrings.

    Fragments from the source are data; do not render as HTML or execute them.
    """
    if not isinstance(description, str):
        return []
    hits: list[dict] = []
    seen: set[str] = set()
    for anchor in ANCHOR.finditer(description):
        after = description[anchor.end(): anchor.end() + 220]
        after = re.split(r';|\n|(?<!\d)\.(?!\d)', after, maxsplit=1)[0]
        fragment = after.lstrip(' \t\r\n,:#\u2018\u2019\u201c\u201d\"')
        # After e.g. "model numbers are: X"; do not skip arbitrary prose.
        fragment = re.sub(r'(?i)^(?:involved\s+in\s+(?:this\s+|the\s+)?recall\s+(?:are|include)|are|include|includes)\s*:?\s*', '', fragment)
        if NOISE_LEADS.match(fragment):
            continue
        # Legacy manufacturer writing sometimes has "model number, T1".
        adjusted = _remove_marketing_quotes(fragment)
        matches = [m for m in TOKEN.finditer(adjusted) if m.group(1).lower() not in {"and", "or", "the", "&"}]
        if not matches:
            continue
        first = matches[0]
        if first.start() > 5:
            continue
        code = first.group(1)
        found = [first]
        prev_end = first.end()
        # A rare source format has a two-token model e.g. "WWH 2052A".
        multi = None
        if re.fullmatch(r"[A-Z]{2,5}", code) and len(matches) > 1:
            second = matches[1]
            gap = adjusted[first.end():second.start()]
            if re.fullmatch(r"\s+", gap) and any(ch.isdigit() for ch in second.group(1)) and plausible(second.group(1)):
                multi = (code + ' ' + second.group(1), first.start(), second.end())
                found = []
        if multi is None and not plausible(code, fragment[:55]):
            continue
        if multi is not None:
            value, lstart, lend = multi
            if canon(value) not in seen:
                exact = re.search(re.escape(value), description[anchor.end():anchor.end()+220], flags=re.I)
                if exact:
                    start = anchor.end()+exact.start()
                    hits.append({'value':value,'start':start,'end':start+len(value),
                                 'evidence_text':description[max(0,anchor.start()-35):min(len(description),start+len(value)+65)].strip()[:230],
                                 'evidence_kind':'EXPLICIT_COMPOSITE_MODEL_PHRASE','review_status':'UNREVIEWED_PROPOSAL',
                                 'automatic_adjudication_enabled':False})
                    seen.add(canon(value))
            continue
        for m in matches[1:]:
            gap = adjusted[prev_end:m.start()]
            if STOP_START.match(adjusted[prev_end:].lstrip(' ,:/\t')):
                break
            if not CONJ_GAP.fullmatch(gap) or not re.search(r"[,;&]|\b(?:and|or)\b", gap, re.I):
                break
            c = m.group(1)
            if not plausible(c, fragment[:m.end()], allow_alpha_list_member=True):
                break
            found.append(m)
            prev_end = m.end()
            if len(found) >= 40:
                break
        for m in found:
            code = m.group(1)
            # Explicit exclusions (e.g. "model 020 ... not affected") are not recalled models.
            follow = fragment[m.end():m.end()+115]
            if re.search(r"(?i)\b(?:is|are|was|were)\s+not\s+(?:affected|recalled|included)\b", follow):
                continue
            if PURE_ALPHA_MODEL.fullmatch(code) and re.match(r"\s+[A-Z][a-z]{2,}\s+\d", adjusted[m.end():m.end()+30]):
                # e.g. "and TGB Blade 600" where TGB is brand and Blade is model family
                continue
            key = canon(code)
            if key in seen:
                continue
            # Find exact evidence in the unmodified original near this anchor.
            original_fragment_start = anchor.end() + len(after) - len(after.lstrip(' \t\r\n,:#\u2018\u2019\u201c\u201d\"'))
            window = description[anchor.end():anchor.end()+220]
            match_exact = re.search(re.escape(code), window, flags=re.I)
            if match_exact is None:
                continue
            start = anchor.end() + match_exact.start()
            stop = start + len(code)
            hits.append({
                'value': code, 'start': start, 'end': stop,
                'evidence_text': description[max(0, anchor.start()-35): min(len(description), stop+65)].strip()[:230],
                'evidence_kind': 'EXPLICIT_MODEL_PHRASE',
                'review_status': 'UNREVIEWED_PROPOSAL',
                'automatic_adjudication_enabled': False,
            })
            seen.add(key)
    # Base model references can be prefixed by the manufacturer, e.g. "base model Kubota RTV-X1100C".
    for match in re.finditer(r"(?i)\bbase\s+model\s+[A-Z][A-Za-z]+\s+([A-Z0-9]+(?:[-_.+][A-Z0-9]+){1,4})", description):
        code = match.group(1)
        if canon(code) not in seen and plausible(code):
            hits.append({'value':code, 'start':match.start(1), 'end':match.end(1),
                         'evidence_text':description[max(0,match.start()-35):min(len(description),match.end()+75)].strip()[:230],
                         'evidence_kind':'EXPLICIT_BASE_MODEL_PHRASE',
                         'review_status':'UNREVIEWED_PROPOSAL','automatic_adjudication_enabled':False})
            seen.add(canon(code))
    # An old CPSC source has OCR punctuation "Model PHT417.e" and another
    # independent occurrence "Model PHT417". Suppress such an artifact only
    # when the exact unpunctuated base also has its own model evidence.
    keys = {canon(x['value']) for x in hits}
    hits = [x for x in hits if not (re.fullmatch(r"[A-Z0-9]+\.E", canon(x['value']))
            and canon(x['value']).rsplit('.', 1)[0] in keys)]
    return hits


def proposals(description: str) -> list[str]:
    return [p['value'].upper() for p in propose_models(description)]