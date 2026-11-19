const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const loc=process.env.REGION||'nanjo',allCfg={nanjo:{name:'南城市',images:4,line:10,faq:8,copy:'通常分解で十分か',check:'分解できる範囲は機種・設置状況によって異なります'},naha:{name:'那覇市',images:4,line:10,faq:8,copy:'駐車場・搬入経路',check:'追加費用が生じる条件'},yaese:{name:'八重瀬町',images:4,line:9,faq:8,copy:'新築でも',check:'ご相談'}};
const cfg=allCfg[loc];if(!cfg)throw Error('Unknown region '+loc);const url='https://teruya1229.github.io/cursor-test/'+loc+'.html';
const out='qa-regional-live-'+loc;fs.mkdirSync(out,{recursive:true});
const assert=(x,msg)=>{if(!x)throw Error(msg)};
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),summary=[];
try{for(const width of [1440,390,320]){
const ctx=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
const p=await ctx.newPage(),errors=[],bad=[];
p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith('https://teruya1229.github.io/')&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await p.route('**/*',route=>{const u=route.request().url();return u.startsWith('https://teruya1229.github.io/')||u.startsWith('data:')?route.continue():route.abort('blockedbyclient')});
let res=await p.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
for(let i=0;i<5&&!(await p.locator('body').textContent()).includes(cfg.check);i++){await p.waitForTimeout(2400);res=await p.reload({waitUntil:'domcontentloaded',timeout:45000})}
await p.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
await p.evaluate(async()=>{await Promise.all([...document.images].map(e=>e.decode().catch(()=>{})));for(let y=0;y<document.documentElement.scrollHeight;y+=850){scrollTo(0,y);await new Promise(r=>setTimeout(r,10))}scrollTo(0,0)});
const info=await p.evaluate(()=>{
const ids=new Set([...document.querySelectorAll('[id]')].map(e=>e.id));
return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
h1:document.querySelector('h1')?.innerText||'',h1WordBreak:getComputedStyle(document.querySelector('h1')).wordBreak,h1Wbr:document.querySelector('h1 wbr')!==null,allText:document.body.textContent,
images:[...document.images].map(e=>({src:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0})),
line:[...document.querySelectorAll('a[href*="lin.ee"]')].map(e=>e.getAttribute('href')),
tel:[...document.querySelectorAll('a[href^="tel:"]')].map(e=>e.getAttribute('href')),
faq:document.querySelectorAll('#faq details.faq-details').length,
links:[...document.querySelectorAll('a[href]')].map(e=>e.getAttribute('href')),
anchors:[...document.querySelectorAll('a[href^="#"]')].map(e=>e.getAttribute('href').slice(1)).filter(x=>x&&!ids.has(x)),
overflow:[...document.querySelectorAll('h1,h2,h3,h4,p,a,summary')].filter(e=>e.getClientRects().length&&!e.closest('.header-nav')).map(e=>({t:(e.textContent||'').slice(0,25),r:e.getBoundingClientRect()})).filter(e=>e.r.width>0&&(e.r.left<-5||e.r.right>innerWidth+5)).slice(0,10)};});
await p.screenshot({path:path.join(out,loc+'-'+width+'.png'),fullPage:true,animations:'disabled',timeout:60000});
assert(res.status()===200,'HTTP '+width);assert(info.width===info.scrollWidth,'Horizontal '+width);
assert(info.allText.includes(cfg.copy)&&info.allText.includes(cfg.check),'New copy '+width);
assert(info.h1.includes(cfg.name)&&info.h1WordBreak==='keep-all'&&info.h1Wbr,'H1 corrected '+width);
assert(info.images.length===cfg.images&&info.images.every(i=>i.loaded),'Images '+width);
assert(info.line.length===cfg.line&&info.faq===cfg.faq,'CTA/FAQ '+width);
assert(!info.anchors.length&&!info.overflow.length&&!errors.length&&!bad.length,'Layout '+width+' '+JSON.stringify({overflow:info.overflow,anchors:info.anchors,errors,bad}));
const faqs=p.locator('#faq details.faq-details');for(let i=0;i<await faqs.count();i++){const item=faqs.nth(i),v=await item.evaluate(e=>e.open);await item.locator('summary').click();assert((await item.evaluate(e=>e.open))!==v,'FAQ toggle '+i+' '+width);await item.locator('summary').click();assert((await item.evaluate(e=>e.open))===v,'FAQ restore '+i+' '+width);}
summary.push({width,http:res.status(),images:info.images.length,faq:info.faq,line:info.line.length,tel:info.tel.length,errors:errors.length,pass:true});await ctx.close();}
console.log('REGIONAL_'+loc.toUpperCase()+'_LIVE_PASS '+JSON.stringify(summary));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(summary,null,2));
}finally{await browser.close()}})().catch(e=>{console.error('REGIONAL_'+loc.toUpperCase()+'_LIVE_FAIL',e);process.exit(1)});