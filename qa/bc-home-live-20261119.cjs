const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const out='qa-bc-home-live';fs.mkdirSync(out,{recursive:true});const assert=(v,m)=>{if(!v)throw Error(m)};
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),all=[];
try{for(const width of [1440,390,320]){
const ctx=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[],bad=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith('https://teruya1229.github.io/')&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await page.route('**/*',r=>{const u=r.request().url();return u.startsWith('https://teruya1229.github.io/')||u.startsWith('data:')?r.continue():r.abort('blockedbyclient')});
const resp=await page.goto('https://teruya1229.github.io/',{waitUntil:'domcontentloaded',timeout:45000});
for(let t=0;t<5;t++){if((await page.locator('.hero-lead').innerText()).includes('現場経験17年の代表'))break;await page.waitForTimeout(2500);await page.reload({waitUntil:'domcontentloaded',timeout:45000});}
await page.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
await page.evaluate(async()=>{await Promise.all([...document.images].map(e=>e.decode().catch(()=>{})));for(let y=0;y<document.documentElement.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,12))}scrollTo(0,0)});
const data=await page.evaluate(()=>{
const ids=new Set([...document.querySelectorAll('[id]')].map(e=>e.id));
return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
hero:document.querySelector('.hero-lead')?.innerText,
newLink:[...document.querySelectorAll('.hero-actions a[href="/prices/"]')].map(e=>e.textContent.trim()),
images:[...document.images].map(e=>({src:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0})),
line:[...document.querySelectorAll('a[href*="lin.ee"]')].map(e=>e.getAttribute('href')),
tel:[...document.querySelectorAll('a[href^="tel:"]')].map(e=>e.getAttribute('href')),
faqs:document.querySelectorAll('#faq details.faq-item').length,
badAnchors:[...document.querySelectorAll('a[href^="#"]')].map(e=>e.getAttribute('href').slice(1)).filter(id=>id&&!ids.has(id)),
overflow:[...document.querySelectorAll('h1,h2,h3,p,a,summary')].filter(e=>e.getClientRects().length).map(e=>({txt:(e.textContent||'').slice(0,20),r:e.getBoundingClientRect()})).filter(x=>x.r.width>0&&(x.r.left < -4||x.r.right > innerWidth+4)).slice(0,7)};
});
await page.screenshot({path:path.join(out,'live-'+width+'.png'),fullPage:true,animations:'disabled',timeout:60000});
const faq=page.locator('#faq details.faq-item');for(let i=0;i<await faq.count();i++){const item=faq.nth(i),first=await item.evaluate(e=>e.open);await item.locator('summary').click();assert(await item.evaluate(e=>e.open)!==first,'faq toggle '+i);await item.locator('summary').click();assert(await item.evaluate(e=>e.open)===first,'faq restore '+i);}
assert(resp.status()===200,'HTTP '+width);assert(data.width===data.scrollWidth,'horizontal '+width);
assert(data.hero.includes('現場経験17年の代表')&&data.newLink.length===1,'copy/link '+width);
assert(data.images.length===20&&data.images.every(e=>e.loaded),'photo '+width);
assert(data.line.length===4&&data.tel.length===5&&data.faqs===6,'CTA/FAQ '+width);
assert(!data.badAnchors.length&&!data.overflow.length&&!errors.length&&!bad.length,'layout error '+width);
all.push({width,http:resp.status(),images:data.images.length,faq:data.faqs,line:data.line.length,tel:data.tel.length,newLink:data.newLink.length,errors:errors.length,pass:true});await ctx.close();
}console.log('HOME_LIVE_PASS '+JSON.stringify(all));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(all,null,2));
}finally{await browser.close()}})().catch(e=>{console.error('HOME_LIVE_FAIL',e);process.exit(1)});