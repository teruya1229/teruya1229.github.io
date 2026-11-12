"""Build a single-file, offline human-review form from v8 unapproved table candidates.
All external source text is inserted as textContent, never as executable HTML.
"""
from pathlib import Path
import argparse,hashlib,json

TEMPLATE = r'''<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AIデータ工場｜表形式データ検品 v8</title>
<style>
:root {font-family: system-ui, -apple-system,"Noto Sans JP",sans-serif;color:#162337;background:#f4f6f9}
* {box-sizing:border-box}body{margin:0}.layout{max-width:1130px;margin:auto;padding:20px}
header{background:#10263e;color:white;padding:22px;border-radius:16px;margin-bottom:16px}
h1{font-size:1.45rem;margin:0 0 8px}.muted{color:#596779}header .muted{color:#d7e7f3}
.warning{border:1px solid #f0b347;background:#fff6e1;padding:13px;border-radius:12px;margin-bottom:16px;font-size:.94rem}
.summary{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.pill{background:#e8eef6;padding:8px 10px;border-radius:10px;font-weight:600}
.toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0}
button,input,textarea{font:inherit}button{border:1px solid #a5afbc;border-radius:10px;background:#fff;padding:9px 12px;cursor:pointer}
button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #68a8d9}
button.primary{background:#133d62;border-color:#133d62;color:white}button.select{background:#ebf1fb;border-color:#7aa5e0}
input[type=search]{padding:10px;min-width:220px;flex:1;border:1px solid #c6d0dc;border-radius:10px}
.card{background:#fff;border:1px solid #e0e6ef;border-radius:14px;padding:18px;margin-bottom:14px;box-shadow:0 1px 3px #192c4211}
.tag{font-size:.79rem;background:#eef4fa;color:#123f69;border-radius:6px;padding:4px 7px;display:inline-block;white-space:normal}
.source{font-size:.85rem;overflow-wrap:anywhere}.source a{color:#064c83}
.item{border:1px solid #dce3ed;background:#f9fbfd;border-radius:9px;margin:12px 0;padding:10px}
.fields{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.field{border:1px solid #d0dae4;background:white;border-radius:6px;padding:5px 7px;display:inline-block;max-width:100%;overflow-wrap:anywhere;font-size:.88rem}
.field b{font-size:.68rem;display:block;color:#536578}
blockquote{white-space:pre-wrap;background:#eef3f8;border-left:4px solid #8aa9c8;margin:8px 0;padding:8px;word-break:break-word;max-height:180px;overflow:auto;font-size:.83rem}
label{display:block;margin:8px 0;font-size:.9rem}textarea{width:100%;min-height:70px;border:1px solid #c6d0dc;border-radius:8px;padding:8px}
.choices{display:flex;gap:10px;flex-wrap:wrap}.choices label{padding:6px;border-radius:7px;background:#edf1f7}
.progress{font-size:.88rem;color:#52667b;margin:8px 0}
footer{color:#57677a;font-size:.85rem;padding:12px 2px 32px}
@media(max-width:500px){.layout{padding:10px}header{padding:18px}.card{padding:12px}h1{font-size:1.2rem}.toolbar>*{flex:1 1 130px}}
</style></head><body><div class="layout"><header><h1>AIデータ工場｜表形式データ検品 v8</h1>
<div class="muted">年式・型番・日付コード・UPC・シリアル接頭辞を区別するための審査画面</div></header>
<div class="warning"><b>重要：</b>この画面の情報はすべて未審査です。「採用候補」は商品リコールの対象確定・販売可否・安全証明ではありません。入力した判断は本番のルールに反映されません。</div>
<div class="summary"><div class="pill" id="total"></div><div class="pill" id="done"></div><div class="pill" id="pending"></div></div>
<div class="toolbar"><input type="search" id="search" placeholder="通知番号・タイトル・型番を検索" aria-label="通知を検索">
<button id="prev">前へ</button><button id="next">次へ</button><button class="primary" id="export">検品結果JSONを保存</button><button id="import">保存済みJSONを読み込む</button><input type="file" id="upload" accept="application/json,.json" hidden></div>
<div id="position" class="progress"></div><main id="main" aria-live="polite"></main>
<footer>実データの出典は各通知のCPSC公式リンク。情報は画面表示用の記録候補であり、公式通知原本と現品の追加条件を必ず確認してください。データはネットワーク送信されません。</footer></div>
<script id="source" type="application/json">__DATA__</script>
<script>
'use strict';
const pack = JSON.parse(document.getElementById('source').textContent);
const records=pack.records;
const lookup=new Map(records.map((r,i)=>[String(r.recall_id),i]));
const decisions={}; let order=records.map((_,i)=>i),cursor=0;
const el=id=>document.getElementById(id);
function txt(tag,str,css){const x=document.createElement(tag);x.textContent=String(str==null?'':str);if(css)x.className=css;return x}
function safeURL(uri){try {const u=new URL(uri);return u.protocol==='https:'&&['cpsc.gov','www.cpsc.gov'].includes(u.hostname)&&u.pathname.toLowerCase().startsWith('/recalls/')?u.href:null;}catch(e){return null}}
function key(record,i){return String(record.recall_id)+':'+i}
function count(){const values=Object.values(decisions);el('total').textContent=records.length+'通知を表示';el('done').textContent=values.filter(x=>x.status&&x.status!=='保留').length+'項目を評価';el('pending').textContent=values.filter(x=>x.status==='保留').length+'項目を保留'}
function render(){count();const root=el('main');root.replaceChildren();if(!order.length){root.append(txt('p','一致する通知がありません'));return}
 cursor=Math.max(0,Math.min(cursor,order.length-1));const r=records[order[cursor]];
 el('position').textContent=(cursor+1)+' / '+order.length+' 件　通知ID: '+r.recall_id;
 const card=txt('section','', 'card');card.append(txt('h2',r.title||('通知 '+r.recall_id)));
 const meta=txt('p','公表日: '+(r.recall_date||'未取得')+'　型番候補行数: '+r.typed_rows.length+'　未解釈項目: '+r.unresolved.length,'muted');card.append(meta);
 const link=safeURL(r.source_url);if(link){const p=txt('p','出典: ','source');const a=txt('a',link);a.href=link;a.target='_blank';a.rel='noopener noreferrer';p.append(a);card.append(p)}
 if(!r.typed_rows.length)card.append(txt('p','この通知は列構造を確認できず保留。公式通知を確認してください。','warning'));
 r.typed_rows.forEach((row,i)=>{const box=txt('div','', 'item');box.append(txt('div',row.table_kind,'tag'));
 const fields=txt('div','', 'fields');row.cells.forEach(cell=>{const b=txt('div','', 'field');b.append(txt('b',cell.role));b.append(txt('span',cell.value));fields.append(b)});box.append(fields);
 box.append(txt('blockquote',row.evidence_excerpt||'', 'evidence'));
 const k=key(r,i),saved=decisions[k]||{status:'保留',note:''};
 const options=txt('div','', 'choices');['保留','採用候補','誤抽出'].forEach(option=>{const l=txt('label','');const input=document.createElement('input');input.type='radio';input.name='v'+k;input.value=option;input.checked=saved.status===option;
 input.addEventListener('change',()=>{decisions[k]={status:option,note:note.value};count()});l.append(input,l.appendChild(txt('span',option)));options.append(l)});box.append(options);
 const lbl=txt('label','検品メモ');const note=document.createElement('textarea');note.value=saved.note||'';note.placeholder='根拠と不足情報を記録（未承認のまま）';note.addEventListener('input',()=>{decisions[k]={status:(decisions[k]||saved).status,note:note.value}});lbl.append(note);box.append(lbl);card.append(box)});
 r.unresolved.forEach(x=>{const item=txt('div','', 'item');item.append(txt('span','保留 '+x.kind,'tag'));item.append(txt('p',x.reason||'構造の審査が必要'));if(x.excerpt)item.append(txt('blockquote',x.excerpt));card.append(item)});
 root.append(card)
}
function applyFilter(){const q=el('search').value.trim().toLowerCase();order=records.map((r,i)=>({r,i})).filter(({r})=>!q||[r.title,r.recall_id,r.source_url,...r.typed_rows.flatMap(x=>x.cells.map(c=>c.value))].join(' ').toLowerCase().includes(q)).map(x=>x.i);cursor=0;render()}
el('prev').addEventListener('click',()=>{cursor=(cursor-1+order.length)%Math.max(order.length,1);render()});
el('next').addEventListener('click',()=>{cursor=(cursor+1)%Math.max(order.length,1);render()});
el('search').addEventListener('input',applyFilter);
el('export').addEventListener('click',()=>{const obj={schema:'cpsc-review-decisions-v8',sample_sha256:pack.sample_sha256,source:'CPSC',review_only:true,automatic_adjudication_enabled:false,is_safety_clearance:false,decisions};const file=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download='cpsc_table_review_v8.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)});
el('import').addEventListener('click',()=>el('upload').click());
el('upload').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>3_000_000)throw Error('ファイルが大きすぎます');const obj=JSON.parse(await f.text());if(obj.schema!=='cpsc-review-decisions-v8'||obj.sample_sha256!==pack.sample_sha256||obj.review_only!==true||obj.automatic_adjudication_enabled!==false)throw Error('互換性・安全性を確認できません');
 for(const [key,x] of Object.entries(obj.decisions||{})){const [id,idx]=key.split(':');if(!lookup.has(id)||!Number.isInteger(+idx)||+idx<0||+idx>=records[lookup.get(id)].typed_rows.length||!['保留','採用候補','誤抽出'].includes(x.status)||typeof x.note!=='string'||x.note.length>4000)throw Error('審査項目の形式が不正です')}
 Object.keys(decisions).forEach(k=>delete decisions[k]);Object.assign(decisions,obj.decisions);render();alert('審査結果を復元しました');}catch(err){alert('読み込み不可: '+err.message)}finally{e.target.value=''}});
render();
</script></body></html>'''


def generate(source:Path,destination:Path):
    package=json.loads(source.read_text(encoding='utf-8'))
    data={'records':package['records'],'sample_sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
    escaped=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(TEMPLATE.replace('__DATA__',escaped),encoding='utf-8')
    return destination

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--sample',required=True);p.add_argument('--out',required=True);a=p.parse_args();generate(Path(a.sample),Path(a.out))