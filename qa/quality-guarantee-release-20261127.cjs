const {chromium}=require('playwright'),fs=require('fs'),cp=require('child_process');
const root='https://teruya1229.github.io/',out='qa-quality-release',commit='7f53e0b68ce3ef7a063c79c0fa13bef18bb1b007';
const targets=[['cursor-test/index.html','cursor-test/'],['cursor-test/central.html','cursor-test/central.html'],['washing-machine-cleaning/index.html','washing-machine-cleaning/']];
fs.mkdirSync(out,{recursive:true});
const rows=[],check=(v,m)=>{if(!v)throw Error(m)},norm=s=>s.replace(/\r\n/g,'\n').trim();
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});try{
for(const [file,url] of targets)for(const w of [1440,390,320]){
 const row={file,width:w};const p=await b.newPage({viewport:{width:w,height:w===1440?900:w===390?844:568},reducedMotion:'reduce',deviceScaleFactor:1});
 try{
 const runtime=[],bad=[];p.on('pageerror',e=>runtime.push(e.message));p.on('response',r=>{if(r.url().startsWith(root)&&r.status()>=400)bad.push(r.status()+' '+r.url())});
 await p.route('**/*',r=>{const u=r.request().url();return u.startsWith(root)||/^data:|^blob:|^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)?r.continue():r.abort('blockedbyclient')});
 await p.addInitScript(()=>{window.__bcQaClicks=[];document.addEventListener('click',e=>{const a=e.target.closest?.('a');if(a&&/^(https?:\/\/(?:lin\.ee\/|line\.me\/|airrsv\.net\/)|tel:)/i.test(a.getAttribute('href')||'')){window.__bcQaClicks.push({href:a.href,trusted:e.isTrusted});e.preventDefault()}},true)});
 const expected=cp.execFileSync('git',['show',commit+':'+file],{encoding:'utf8',maxBuffer:8*1024*1024});
 let res;for(let t=0;t<10;t++){res=await p.goto(root+url,{waitUntil:'domcontentloaded',timeout:30000});if(norm(await res.text())===norm(expected))break;await p.waitForTimeout(3000)}
 row.http=res.status();row.source=norm(await res.text())===norm(expected);check(row.http===200&&row.source,'deployed source mismatch');
 await p.evaluate(async()=>{await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2000))]);await Promise.all([...document.images].filter(i=>i.getBoundingClientRect().top<innerHeight&&i.getAttribute('src')).map(i=>i.decode().catch(()=>{})));scrollTo(0,0)});
 row.layout=await p.evaluate(()=>{const pos=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {top:Math.round(r.top+scrollY),bottom:Math.round(r.bottom+scrollY),left:r.left,right:r.right,order:getComputedStyle(e).order}};return{h1:pos('main h1'),brief:pos('.bcq-brief'),detail:pos('.bcq-detail'),faq:pos('#faq'),scroll:document.documentElement.scrollWidth,inner:innerWidth,cta:[...document.querySelectorAll('main a[href^="https://lin.ee/"],main a[href^="https://airrsv.net/"]')].filter(e=>e.getBoundingClientRect().width).map(e=>({top:Math.round(e.getBoundingClientRect().top+scrollY),text:e.innerText.trim().slice(0,60)})).slice(0,4)}});
 const z=row.layout;check(z.h1.top<z.brief.top&&z.detail.top>z.h1.bottom&&z.detail.top<z.faq.top,'display order incorrect');check(z.scroll<=w+1&&z.brief.left>=-1&&z.brief.right<=w+1,'horizontal overflow');
 const name=file.replace(/\/index.html$/,'').replace(/\.html$/,'').replace(/\//g,'-')+'-'+w;
 await p.screenshot({path:out+'/'+name+'-hero.png',animations:'disabled'});
 await p.locator('.bcq-detail').scrollIntoViewIfNeeded();await p.screenshot({path:out+'/'+name+'-detail.png',animations:'disabled'});
 if(w===390){
 const ev=()=>p.evaluate(()=>[...(window.dataLayer||[])].filter(e=>e[0]==='event').map(e=>e[1]));
 row.cta=[];for(const [type,sel] of [['line','a[href^="https://lin.ee/"]'],['tel','a[href^="tel:"]'],['reserve','a[href^="https://airrsv.net/"]']]){
 const items=p.locator(sel);let a;for(let i=0;i<await items.count();i++){if(await items.nth(i).isVisible()){a=items.nth(i);break}}if(!a)continue;const n=(await ev()).length,before=await p.evaluate(()=>window.__bcQaClicks.length);
 await a.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await a.click({timeout:8000});const clicks=await p.evaluate(()=>window.__bcQaClicks.slice());const events=(await ev()).slice(n);check(clicks.length>before&&clicks.at(-1).trusted,'CTA '+type);check(events.length>0,'CTA measurement '+type);row.cta.push({type,events});
 }
 const faq=p.locator('#faq details');let tested=0;for(let i=0;i<await faq.count();i++){const d=faq.nth(i),s=d.locator(':scope > summary');if(!await s.isVisible())continue;const was=await d.evaluate(e=>e.open);await s.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await s.click({timeout:10000});check(await d.evaluate(e=>e.open)!==was,'FAQ open');await s.click({timeout:10000});check(await d.evaluate(e=>e.open)===was,'FAQ close');tested++}row.faq=tested;
 if(file==='washing-machine-cleaning/index.html'){
 const form=p.locator('#washer-diagnosis-form'),result=p.locator('#washer-diagnosis-result');row.diagnosis=[];for(const type of ['top','drum']){await form.locator('input[name="washer_type"][value="'+type+'"]').check();for(const name of ['usage_age','symptom']){const s=form.locator('select[name="'+name+'"]');await s.selectOption(await s.locator('option').evaluateAll(es=>es.find(e=>e.value&&!e.disabled).value))}const n=(await ev()).length;await form.locator('button[type=submit]').click();await result.waitFor({state:'visible'});const events=(await ev()).slice(n),scores=await result.locator('[role=progressbar]').evaluateAll(es=>es.map(e=>Number(e.getAttribute('aria-valuenow'))));check(scores.length===3&&scores.reduce((a,b)=>a+b,0)===100&&events.includes('diagnosis_submit')&&events.includes('diagnosis_result_view'),'diagnosis failed');row.diagnosis.push({type,events,scores})}
 }
 const a=p.locator('a.bcq-link[href^="/quality-guarantee/"]').first();await a.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await a.click();await p.waitForURL('**/quality-guarantee/**');const hash=new URL(p.url()).hash;check(!!hash&&await p.locator(hash).count()===1,'guarantee anchor');row.policy=p.url();
 }
 check(!runtime.length&&!bad.length,'runtime/asset errors '+JSON.stringify({runtime,bad}));row.pass=true;
 }catch(e){row.pass=false;row.error=e.message}finally{await p.close()}rows.push(row);console.log('RELEASE_CASE '+JSON.stringify(row));
 }
 }finally{await b.close()}fs.writeFileSync(out+'/result.json',JSON.stringify(rows,null,2));console.log('RELEASE_SUMMARY '+JSON.stringify({pass:rows.filter(x=>x.pass).length,total:rows.length,failed:rows.filter(x=>!x.pass)}));if(rows.some(x=>!x.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});