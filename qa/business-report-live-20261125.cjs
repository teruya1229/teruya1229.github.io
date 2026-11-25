const {chromium}=require('playwright'),fs=require('fs'),cp=require('child_process');
const target='https://teruya1229.github.io/business-cleaning/',out='qa-business-report';fs.mkdirSync(out,{recursive:true});
const old=cp.execFileSync('git',['show','6f94f32eeba8f81e3fb42d8ba0cd6f70db9605d6^1:business-cleaning/index.html'],{encoding:'utf8'});
const a=(v,msg)=>{if(!v)throw Error(msg)};
const pattern=/<a\b[^>]*>/gi,imgs=/<img\b[^>]*>/gi;
const all=(s,r)=>[...s.matchAll(r)].map(m=>m[0]);
const html=fs.readFileSync('business-cleaning/index.html','utf8');
a(JSON.stringify(all(old,pattern))===JSON.stringify(all(html,pattern)),'anchor changed');
a(JSON.stringify(all(old,imgs))===JSON.stringify(all(html,imgs)),'images changed');
const scripts=/<script\b(?![^>]*type="application\/ld\+json")[\s\S]*?<\/script>/gi;
a(JSON.stringify(all(old,scripts))===JSON.stringify(all(html,scripts)),'GA4 JS changed');
const prevFAQ=[...old.matchAll(/<details\b/g)].length;
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});let rows=[];
try{for(const width of [1440,390,320]){const p=await b.newPage({viewport:{width,height:900},reducedMotion:'reduce',deviceScaleFactor:1});const errors=[],bad=[];
p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith('https://teruya1229.github.io/')&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await p.route('**/*',r=>{const u=r.request().url();return u.startsWith('https://teruya1229.github.io/')||u.startsWith('data:')?r.continue():r.abort('blockedbyclient')});
let r;for(let attempt=0;attempt<10;attempt++){r=await p.goto(target,{waitUntil:'domcontentloaded',timeout:30000});if(await p.locator('.biz3-trust-line').innerText().then(x=>x.includes('写真付き施工報告書無料')))break;await p.waitForTimeout(3000)}
a(r.status()===200,'HTTP '+width);a(await p.locator('.biz3-trust-line li').last().innerText()==='写真付き施工報告書無料','hero copy');
await p.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));await p.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await document.fonts.ready;});
const data=await p.evaluate(()=>{const hero=document.querySelector('.biz3-trust-line li:last-child'),section=[...document.querySelectorAll('#benefits h3')].find(e=>e.textContent.includes('写真付き施工報告書')),q=[...document.querySelectorAll('#faq summary')].find(e=>e.textContent.includes('施工報告書'));const fit=e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.width>0&&r.height>0};return{width:innerWidth,scroll:document.documentElement.scrollWidth,imgs:[...document.images].map(i=>({src:i.getAttribute('src'),ok:i.complete&&i.naturalWidth>0})),faq:document.querySelectorAll('#faq details').length,line:[...document.querySelectorAll('a[href*="lin.ee/"]')].map(e=>e.getAttribute('href')),tel:[...document.querySelectorAll('a[href^="tel:"]')].map(e=>e.getAttribute('href')),report:[hero,section,q].every(e=>e&&fit(e)),benefits:section?.parentElement.innerText||'',schema:[...document.querySelectorAll('script[type="application/ld+json"]')].map(e=>JSON.parse(e.textContent)).find(x=>x['@type']==='FAQPage')?.mainEntity.at(-1),cta:fit(document.querySelector('.biz3-hero .biz3-line-primary')),bodyHeight:document.documentElement.scrollHeight}});
a(data.report&&data.cta,'new text and CTA fit '+width);a(data.scroll<=width,'overflow '+width+': '+data.scroll);
a(data.benefits.includes('本部・オーナー様への報告'),'benefits text');a(data.imgs.every(i=>i.ok),'image missing '+JSON.stringify(data.imgs.filter(i=>!i.ok)));a(data.faq===prevFAQ+1,'FAQ count');
a(data.schema?.name==='施工報告書は作成してもらえますか？','FAQ schema');a(!errors.length&&!bad.length,'runtime '+JSON.stringify({errors,bad}));
await p.screenshot({path:out+'/hero-'+width+'.png',animations:'disabled'});
await p.locator('#benefits').screenshot({path:out+'/benefits-'+width+'.png',animations:'disabled'});
const qs=p.locator('#faq details');for(let i=0;i<await qs.count();i++){const d=qs.nth(i),was=await d.evaluate(e=>e.open);await d.locator('summary').click();a((await d.evaluate(e=>e.open))!==was,'FAQ toggle '+i+' '+width);await d.locator('summary').click();a((await d.evaluate(e=>e.open))===was,'FAQ restore '+i+' '+width)}
const q=qs.last();await q.locator('summary').click();a((await q.innerText()).includes(data.schema.acceptedAnswer.text),'FAQ schema/visible answer mismatch');await q.screenshot({path:out+'/faq-'+width+'.png',animations:'disabled'});await q.locator('summary').click();
await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:out+'/full-'+width+'.png',fullPage:true,animations:'disabled'});
rows.push({width,http:r.status(),images:data.imgs.length,faq:data.faq,line:data.line.length,tel:data.tel.length,reportVisible:true,overflow:0,errors:0,pass:true});await p.close()}
console.log('REPORT_LIVE_PASS '+JSON.stringify(rows));fs.writeFileSync(out+'/report.json',JSON.stringify(rows,null,2));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});