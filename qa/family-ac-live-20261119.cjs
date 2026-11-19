const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const out='qa-family-ac-live';fs.mkdirSync(out,{recursive:true});const assert=(x,m)=>{if(!x)throw Error(m)};
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),all=[];
try{for(const width of [1440,390,320]){
const ctx=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[],bad=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith('https://teruya1229.github.io/')&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await page.route('**/*',r=>{const u=r.request().url();return u.startsWith('https://teruya1229.github.io/')||u.startsWith('data:')?r.continue():r.abort('blockedbyclient')});
let response=await page.goto('https://teruya1229.github.io/cursor-test/',{waitUntil:'domcontentloaded',timeout:45000});
for(let i=0;i<5&&await page.locator('section.project-counter').count();i++){await page.waitForTimeout(2500);response=await page.reload({waitUntil:'domcontentloaded',timeout:45000})}
await page.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
await page.evaluate(async()=>{await Promise.all([...document.images].map(e=>e.decode().catch(()=>{})));for(let y=0;y<document.documentElement.scrollHeight;y+=800){scrollTo(0,y);await new Promise(r=>setTimeout(r,10))}scrollTo(0,0)});
const d=await page.evaluate(()=>{const ids=new Set([...document.querySelectorAll('[id]')].map(e=>e.id));return {
width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
content:document.body.innerText,
images:[...document.images].map(e=>({src:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0})),
line:[...document.querySelectorAll('a[href*="lin.ee"]')].map(e=>e.getAttribute('href')),tel:[...document.querySelectorAll('a[href^="tel:"]')].map(e=>e.getAttribute('href')),
faq:document.querySelectorAll('#faq details.faq-details').length,details:document.querySelectorAll('details').length,
links:[...document.querySelectorAll('a[href]')].map(e=>e.getAttribute('href')),
missing:[...document.querySelectorAll('a[href^="#"]')].map(e=>e.getAttribute('href').slice(1)).filter(id=>id&&!ids.has(id)),
outOfBounds:[...document.querySelectorAll('h1,h2,h3,h4,p,a,summary')].filter(e=>e.getClientRects().length&&!e.closest('.header-nav')).map(e=>({txt:e.textContent.slice(0,20),r:e.getBoundingClientRect()})).filter(e=>e.r.width>0&&(e.r.left<-5||e.r.right>innerWidth+5)).slice(0,10)}});
await page.screenshot({path:path.join(out,'live-'+width+'.png'),fullPage:true,animations:'disabled',timeout:60000});
if(width===320){const nav=page.locator('.header-nav'),p=await nav.evaluate(e=>{e.scrollLeft=e.scrollWidth;const last=e.querySelector('a:last-of-type');const a=e.getBoundingClientRect(),b=last.getBoundingClientRect();return {scrollable:e.scrollWidth>e.clientWidth,visible:b.left>=a.left-3&&b.right<=a.right+3}});assert(p.scrollable&&p.visible,'scrollable nav '+JSON.stringify(p));}
const faq=page.locator('#faq details.faq-details');
for(let i=0;i<await faq.count();i++){const e=faq.nth(i),v=await e.evaluate(x=>x.open);await e.locator('summary').click();assert(await e.evaluate(x=>x.open)!==v,'FAQ open '+i);await e.locator('summary').click();assert(await e.evaluate(x=>x.open)===v,'FAQ close '+i)}
assert(response.status()===200,'HTTP '+width);assert(d.width===d.scrollWidth,'overflow '+width);
assert(d.images.length===21&&d.images.every(e=>e.loaded),'images '+width);assert(d.faq===9&&d.details===12,'FAQ '+width);
assert(d.line.length===13&&d.tel.length===3,'CTA '+width);assert(d.content.includes('200世帯達成まで')&&!d.content.includes('現在：60')&&!d.content.includes('残り 140')&&!d.content.includes('次の応援企画も準備中')&&!d.content.includes('200世帯達成後は洗濯機'),'future promo '+width);
assert(!d.missing.length&&!d.outOfBounds.length&&!errors.length&&!bad.length,'layout/script '+width);
all.push({width,http:response.status(),images:d.images.length,faq:d.faq,details:d.details,line:d.line.length,tel:d.tel.length,errors:errors.length,pass:true});await ctx.close();
}console.log('FAMILY_AIRCON_LIVE_PASS '+JSON.stringify(all));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(all,null,2));
}finally{await browser.close()}})().catch(e=>{console.error('FAMILY_AIRCON_LIVE_FAIL',e);process.exit(1)});