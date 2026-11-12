#!/usr/bin/env python3
"""CPSC notice-scoped decisions against manually reviewed conditions.

One notice is not a full safety clearance. Proposed extracted rules are NEVER
used for judgments; only the fixed five rule records below are evaluated.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

REVIEWED_RULES = {
  11045: {'description_sha256':'f8e26bfe56613dc3f939cd253f7272584a36e54dfd4853ba6187d7cc9b3c1174', 'number':'27066','brand':'Arlopu','type':'exact_model','models':['KT-CS17','LY-31'], 'category':('slide','playset'), 'condition':'Two models; confirm item is Arlopu slide playset and physical label'},
  11056: {'description_sha256':'c50f997146ecd68df24b3879e92ca982ca5bb3e2f4ca996f0a2c004a837f3e7d', 'number':'27073','brand':'Vevor','type':'exact_model','models':['SS24001','SS24002'], 'category':('bmx','bicycle','bike'), 'condition':'20/24-inch BMX bicycle; check physical model on package'},
  11046: {'description_sha256':'d6e01e7583fdd17c7947ad0c6fb4f7814e3508c9c146f847ecf9b2f49f9f4243', 'number':'27069','brand':'Gourmia','type':'model_upc_batch','models':['GTF7530'], 'upc':'810002862779', 'condition':'Manufacturer-specific production codes 3021 to 0126; human verification required'},
  11048: {'description_sha256':'3bb2f6361d89c9aa36c03cf0a7ad53f76527a82cbe2b1393e6c01055cb2b45e6', 'number':'27065','brand':'Bose','type':'battery_serial','prefixes':['083723','078352','084105','078591','078592','084106','086409'], 'condition':'ONLY S1 Pro/S1 Pro+ battery packs, not speaker itself; first six digits of 17-digit battery serial'},
  11051: {'description_sha256':'920895f007cc86fb9dd84fea7b101635a906ae93682463e87ec6d8a2f2b22c68', 'number':'27067','brand':'Little Giant','type':'ladder_sticker','models':['Adjustable Fortress 2.0','Conquest 2.0','Dark Horse 2.0','Epic','King Kombo XT','Leveler','MegaLite','MegaLite+','Multi','Quantum','Vector'], 'condition':'Only specified ladders with Rapid Locks WITHOUT orange rectangular QC sticker'},
}

STATUS = {
 'MODEL_SCOPE_MATCH': '対象型番に一致（現物未確認）',
 'CONDITION_MATCH': '当該通知の対象条件に一致（入力情報ベース）',
 'NOTICE_NONMATCH': '当該通知の条件に非一致',
 'NEED_INFO': '追加情報が必要',
 'UNSCOPED': '判定対象外（収録範囲不足）',
 'INPUT_ERROR': '入力不足',
 'RULE_CONFLICT': '公式データとの整合性エラー',
}


def compact(value):
    return re.sub(r'[^A-Z0-9]', '', str(value or '').upper().replace('+', 'PLUS'))


def safe_notice_url(url):
    try:
        p=urlsplit(url)
        return bool(p.scheme=='https' and p.hostname in ('cpsc.gov','www.cpsc.gov') and
                    p.port is None and not p.username and not p.password and
                    p.path.lower().startswith('/recalls/'))
    except (ValueError, TypeError):
        return False


def rule_evidence_valid(record, rule):
    if not isinstance(record,dict) or record.get('RecallID') not in REVIEWED_RULES:
        return False
    if compact(record.get('RecallNumber')) != compact(rule['number']):
        return False
    if not safe_notice_url(record.get('URL','')):
        return False
    description=str(record.get('Description') or '')
    if hashlib.sha256(description.encode('utf-8')).hexdigest() != rule['description_sha256']:
        return False
    d=compact(description)
    kind=rule['type']
    if kind in ('exact_model','ladder_sticker','model_upc_batch'):
        if not all(compact(m) in d for m in rule['models']):
            return False
    if kind=='model_upc_batch' and not (rule['upc'] in description and '3021' in description and '0126' in description):
        return False
    if kind=='battery_serial' and not ('17' in description and all(p in description for p in rule['prefixes']) and 'battery' in description.lower()):
        return False
    if kind=='ladder_sticker' and not ('QC' in description and 'orange' in description.lower() and 'without' in description.lower()):
        return False
    return True


def verdict(row, code, reason, required, action, record=None, rule=None):
    r = {
      'item_id': row.get('item_id',''),
      'brand': row.get('brand',''),
      'model': row.get('model',''),
      'verdict_code': code,
      'verdict': STATUS[code],
      'reason': reason,
      'required_information': required,
      'recommended_action': action,
      'recall_id': record.get('RecallID','') if record else '',
      'recall_number': record.get('RecallNumber','') if record else '',
      'source_url': record.get('URL','') if record else '',
      'rule_provenance': 'MANUALLY_REVIEWED_NOTICE_CONDITION' if rule else 'NONE',
      'covered_scope': 'SINGLE_US_CPSC_NOTICE_ONLY' if rule else 'NO_COMPLETE_RECALL_COVERAGE',
      'is_safety_clearance': False,
    }
    return r


def item_type_compatible(row, keywords):
    raw = str(row.get('product') or '').lower()
    return not raw or any(x in raw for x in keywords)


def decide_one(row, record, rule):
    typ=rule['type']; model=compact(row.get('model'))
    if typ=='exact_model':
        if model not in {compact(x) for x in rule['models']}:
            return verdict(row,'NOTICE_NONMATCH','当該通知が列挙する型番には一致しない。別の通知の非該当を意味しない。','過去の他のリコール情報','この通知のみに限定して記録',record,rule)
        if not item_type_compatible(row,rule['category']):
            return verdict(row,'NEED_INFO','型番は一致するが在庫の製品分類が公式通知と食い違う','実物の製品ラベル・写真','販売・使用を保留し商品を確認',record,rule)
        return verdict(row,'MODEL_SCOPE_MATCH','公式の対象型番に一致。実物・対象製品群の照合は未完了','実物ラベル・製品写真','販売を保留し公式通知の回収・修理案内を確認',record,rule)
    if typ=='model_upc_batch':
        if model!=compact(rule['models'][0]):
            return verdict(row,'NOTICE_NONMATCH','この通知の型番に一致しない。安全保証ではない。','他の通知履歴','この通知との結果に限定',record,rule)
        upc=compact(row.get('upc'))
        if not upc:
            return verdict(row,'NEED_INFO','対象型番には一致するがUPC未入力','包装のUPC写真と本体の製造コード','販売・使用を保留して確認',record,rule)
        if upc!=rule['upc']:
            return verdict(row,'NEED_INFO','対象型番には一致するがUPCが通知と異なる。入力ミスや梱包違いの可能性','実際の包装UPC・本体型番写真','販売を保留してメーカーに確認',record,rule)
        batch=str(row.get('batch') or '').strip()
        if not batch:
            return verdict(row,'NEED_INFO','型番・UPC一致。製造コード条件が未判定','本体ラベルの製造コード写真','販売・使用を保留して確認',record,rule)
        # The actual producer-defined 3021..0126 code interpretation is unverified.
        return verdict(row,'NEED_INFO',f'型番・UPC一致。製造コード「{batch}」の公式判定方法を未検証のため確定しない','製造コード解釈・現物ラベル','メーカーの公式判定方法を照合',record,rule)
    if typ=='battery_serial':
        if not ('S1PRO' in model):
            return verdict(row,'NOTICE_NONMATCH','対象のS1 Pro/S1 Pro+バッテリー系統と特定できない','正確なバッテリー型名','この通知に限定して判定',record,rule)
        product=str(row.get('product') or '').lower()
        if not any(x in product for x in ('battery','バッテリー','電池')):
            return verdict(row,'NEED_INFO','対象はスピーカー本体ではなく、装着または別売のバッテリーパック','バッテリー実物と17桁シリアル番号','電池パックを確認し公式案内に従う',record,rule)
        serial=re.sub(r'\s','',str(row.get('serial') or ''))
        if not re.fullmatch(r'\d{17}',serial):
            return verdict(row,'NEED_INFO','バッテリーパックの17桁シリアル番号が不足または形式不正','バッテリー底面のシリアル番号','使用を保留しラベルを確認',record,rule)
        if serial[:6] in rule['prefixes']:
            return verdict(row,'CONDITION_MATCH','バッテリー製品群・17桁番号の先頭6桁が公式対象条件に一致（入力値の真正性は未検証）','現物ラベル照合','電池の使用を停止してメーカー交換案内へ',record,rule)
        return verdict(row,'NOTICE_NONMATCH','バッテリーの先頭6桁がこの通知の指定範囲に一致しない。別通知の安全証明ではない。','メーカーによる番号再確認','当該通知のみの判定とする',record,rule)
    if typ=='ladder_sticker':
        if model not in {compact(x) for x in rule['models']}:
            return verdict(row,'NEED_INFO','入力値が機構名か機種名か不明。対象梯子の機種名を要確認','梯子本体側面の正式機種名','使用を保留し対象機種一覧と照合',record,rule)
        if not item_type_compatible(row,('ladder','梯子','はしご')):
            return verdict(row,'NEED_INFO','入力型番は一致するが製品種別が一致しない','梯子本体写真','実物を確認する',record,rule)
        qc=str(row.get('qc_sticker') or '').lower().strip()
        if qc in {'no','none','absent','false','なし','無'}:
            return verdict(row,'CONDITION_MATCH','対象機種でオレンジQCシールがないという入力条件に一致','現物の機種名とQCシール写真','梯子の使用を停止しメーカーの対応案内を確認',record,rule)
        if qc in {'yes','present','true','あり','有'}:
            return verdict(row,'NOTICE_NONMATCH','対象機種だが通知が対象外とするオレンジQCシールがあるとの入力','現物のシール写真','当該通知だけの結果として記録',record,rule)
        return verdict(row,'NEED_INFO','対象機種には一致するがQCステッカーが未確認','オレンジQCステッカーの有無','本体写真を確認',record,rule)
    raise ValueError('Unknown reviewed rule type')


def adjudicate(row, records):
    item_id=str(row.get('item_id') or '').strip()
    brand=str(row.get('brand') or '').strip()
    model=str(row.get('model') or '').strip()
    if not item_id or not brand or not model:
        return [verdict(row,'INPUT_ERROR','在庫ID・メーカー・型番の必須項目が不足','item_id / brand / model','在庫データを補完')]
    rules=[(rid,rule) for rid,rule in REVIEWED_RULES.items() if compact(rule['brand'])==compact(brand)]
    if not rules:
        return [verdict(row,'UNSCOPED','この試作で検証済みの通知条件は5件。過去全件の評価ではない','リコール全件履歴','安全と扱わず別途照合')]
    record_by_id={x.get('RecallID'): x for x in records if isinstance(x,dict)}
    result=[]
    for rid,rule in rules:
        record=record_by_id.get(rid)
        if not record:
            result.append(verdict(row,'UNSCOPED','該当通知が今回の取得期間に入っていないため未評価','該当通知の原文','過去履歴・公式通知を確認'))
        elif not rule_evidence_valid(record,rule):
            result.append(verdict(row,'RULE_CONFLICT','公式JSONと検証済みルールの型番・番号・対象条件の整合が取れない','公式通知の再検証','自動判定せず隔離して再審査'))
        else:
            result.append(decide_one(row,record,rule))
    return result


def protect_spreadsheet(value):
    text=str(value) if value is not None else ''
    if text.lstrip().startswith(('=','+','-','@')) or text[:1] in ('\t','\r','\n'):
        return "'"+text
    return text


def generate(records,inventory):
    if not isinstance(records,list):
        raise ValueError('CPSC feed must be list')
    out=[]
    for row in inventory:
        out.extend(adjudicate(row,records))
    return out


def main():
    a=argparse.ArgumentParser()
    a.add_argument('--raw',required=True)
    a.add_argument('--inventory',required=True)
    a.add_argument('--out',required=True)
    q=a.parse_args()
    raw=json.loads(Path(q.raw).read_text(encoding='utf-8-sig'))
    with open(q.inventory,'r',encoding='utf-8-sig',newline='') as handle:
        items=list(csv.DictReader(handle))
    rows=generate(raw,items)
    output=Path(q.out);output.parent.mkdir(parents=True,exist_ok=True)
    fields=['item_id','brand','model','verdict_code','verdict','reason','required_information','recommended_action','recall_id','recall_number','source_url','rule_provenance','covered_scope','is_safety_clearance']
    with open(output,'w',encoding='utf-8-sig',newline='') as handle:
        w=csv.DictWriter(handle,fieldnames=fields,extrasaction='ignore');w.writeheader();w.writerows([{k:protect_spreadsheet(v) for k,v in r.items()} for r in rows])
    print(json.dumps({'inventory_count':len(items),'result_rows':len(rows),'counts':dict(Counter(x['verdict_code'] for x in rows)),'verified_notice_rules':len(REVIEWED_RULES),'all_notices_reviewed':False,'safety_clearance':False},ensure_ascii=False,sort_keys=True))

if __name__=='__main__':
    main()