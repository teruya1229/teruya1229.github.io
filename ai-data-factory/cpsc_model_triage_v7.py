"""Review-only triage for CPSC model extraction. Never approves a recall determination."""
from __future__ import annotations
import re
TABLE_PATTERNS=[
 ('MODEL_LIST_AFTER_COLON',r'\bmodel\s+numbers?\b[^.\n:]{0,150}:'),
 ('MODEL_DATE_UPC_TABLE',r'\bmodel\s+date\s+codes?\s+UPC\b'),
 ('YEAR_MODEL_TABLE',r'\byear\s+model\s+numbers?\b'),
 ('BRAND_MODEL_TABLE',r'\bbrand\s+model\s+numbers?\b'),
 ('MODEL_SERIAL_RANGE_TABLE',r'\b(?:unit\s+type|products?)\s+models?\s+(?:serial|numbers?)\b|\bmodel\s+(?:serial|number)\s+.*?\bserial\s+(?:number|range)\b'),
 ('RETAILER_STYLE_TABLE',r'\bweb\s+retailer\s+style\s+numbers\b'),
]
SCOPE_MARKERS=[
 ('SERIAL_CONDITION',r'\bserial\s+numbers?\b|\bVIN\b'),
 ('BATCH_OR_LOT_CONDITION',r'\b(?:batch|lot|production)\s+(?:numbers?|codes?)\b'),
 ('DATE_OR_YEAR_CONDITION',r'\b(?:manufactur(?:ed|e|ing)|date\s+codes?|model\s+years?)\b'),
 ('EXCLUSION_OR_VARIANT_CONDITION',r'\b(?:without|except|not\s+affected|only\s+units|not\s+included|only\s+models)\b'),
]
def triage(description:str,count:int)->dict:
    if not isinstance(description,str):description=''
    layouts=[code for code,pattern in TABLE_PATTERNS if re.search(pattern,description,re.I)]
    conditions=[code for code,pattern in SCOPE_MARKERS if re.search(pattern,description,re.I)]
    if layouts:priority,reason='HIGH','MODEL_LIST_OR_TABLE_NEEDS_STRUCTURAL_REVIEW'
    elif not count and re.search(r'\bmodels?\b',description,re.I):priority,reason='MEDIUM','MODEL_MENTION_BUT_NO_EXPLICIT_IDENTIFIER'
    elif count and conditions:priority,reason='MEDIUM','MODEL_IDENTIFIER_WITH_ADDITIONAL_SCOPE_CONDITIONS'
    elif count:priority,reason='LOW','MODEL_IDENTIFIER_NEEDS_OFFICIAL_SOURCE_REVIEW'
    else:priority,reason='LOW','NO_MODEL_IDENTIFIER_FOUND_NO_SAFETY_CLEARANCE'
    return {'priority':priority,'reason':reason,'complex_layout_flags':layouts,
            'additional_condition_flags':conditions,'new_rules_activated':False,
            'is_recall_status_decided':False,'no_match_does_not_mean_safe':True}
TABLE_START=re.compile(r'\b(?:model\s+numbers?\b[^.\n:]{0,170}:|web\s+retailer\s+style\s+numbers\b|model\s+date\s+codes?\s+UPC\b|year\s+model\s+numbers?\b|brand\s+model\s+numbers?\b|unit\s+type\s+model\s+number\b)',re.I)
TABLE_CODE=re.compile(r'(?<![A-Za-z0-9])(?:[A-Z0-9]{2,18}(?:[-._][A-Z0-9]{1,18}){0,3})(?![A-Za-z0-9])')
def table_review_candidates(description:str,high_confidence:list[str]|None=None)->list[dict]:
    if not isinstance(description,str):return []
    known={x.upper() for x in (high_confidence or [])};result=[];seen=set()
    for start in TABLE_START.finditer(description):
        fragment=description[start.end():start.end()+1500]
        fragment=re.split(r'\.(?=\s+[A-Z][a-z])|\bNo other\b',fragment,maxsplit=1)[0]
        for item in TABLE_CODE.finditer(fragment):
            code=item.group(0)
            if not any(ch.isdigit() for ch in code):continue
            if re.fullmatch(r'(?:18|19|20)\d{2}',code) or re.fullmatch(r'\d{10,}',code):continue
            if code.upper() in known or code.upper() in seen:continue
            seen.add(code.upper());pos=start.end()+item.start()
            result.append({'value':code,'start':pos,'end':pos+len(code),
                'evidence_text':description[max(start.start(),pos-65):min(len(description),pos+len(code)+65)][:180],
                'evidence_kind':'TABLE_POSSIBLE_IDENTIFIER_UNVERIFIED','review_status':'UNREVIEWED_TABLE_TOKEN','automatic_adjudication_enabled':False})
            if len(result)>=80:return result
    return result
