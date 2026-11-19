const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const url='https://teruya1229.github.io/mi-bcs/',dir='qa-mi-bcs-live';
fs.mkdirSync(dir,{recursive:true});
const source=fs.readFileSync('mi-bcs/index.html','utf8');
const faqSrc=source.slice(source.indexOf('<section class="section section-light" id="faq">'),source.indexOf('<section class="section" id="lighting">'));
const sourceFaq=[...faqSrc.matchAll(/<details class="faq-item">\s*<summary>(.*?)<\/summary>\s*<p>(.*?)<\/p>\s*<\/details>/gs)].map(m=>({q:m[1].trim(),a:m[2].trim()}));
const assert=(x,why)=>{if(!x)throw Error(why)};
assert(sourceFaq.length===10,'source FAQ expected10');
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true}),all=[];
try{for(const width of [1440,390,320]){
const ctx=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
const page=await ctx.newPage(),errors=[],bad=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().startsWith('https://teruya1229.github.io/')&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await page.route('**/*',route=>{const u=route.request().url();return (u.startsWith('https://teruya1229.github.io/')||u.startsWith('data:'))?route.continue():route.abort('blockedbyclient')});
const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
for(let i=0;i<5&&await page.locator('#faq details.faq-item').count()!==10;i++){await page.waitForTimeout(2500);await page.reload({waitUntil:'domcontentloaded',timeout:45000})}
await page.locator('img').evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));
await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));for(let y=0;y<document.documentElement.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,12))};scrollTo(0,0)});
await page.waitForTimeout(350);
const result=await page.evaluate(()=>{
const ids=new Set([...document.querySelectorAll('[id]')].map(e=>e.id));
return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
hero:document.querySelector('.hero-lead')?.textContent?.trim(),
faq:[...document.querySelectorAll('#faq details.faq-item')].map(e=>({q:e.querySelector('summary')?.textContent.trim(),a:e.querySelector('p')?.textContent.trim()})),
images:[...document.images].map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})),
line:[...document.querySelectorAll('a[href*="lin.ee"]')].map(e=>e.href),
tel:[...document.querySelectorAll('a[href^="tel:"]')].map(e=>e.href),
prices:[...document.querySelectorAll('.tatami-size')].map(e=>e.textContent.trim()),
faqCss:getComputedStyle(document.querySelector('#faq .faq-item')).boxShadow,
missingAnchors:[...document.querySelectorAll('a[href^="#"]')].map(e=>e.getAttribute('href').slice(1)).filter(i=>i&&!ids.has(i)),
outOfBounds:[...document.querySelectorAll('h1,h2,h3,p,a,button,summary')].filter(e=>e.getClientRects().length).map(e=>({text:(e.textContent||'').slice(0,30),rect:e.getBoundingClientRect()})).filter(e=>e.rect.width>0&&(e.rect.left<-4||e.rect.right>innerWidth+4)).slice(0,10)};
});
await page.screenshot({path:path.join(dir,'production-'+width+'-full.png'),fullPage:true,animations:'disabled',timeout:60000});
const details=page.locator('#faq details.faq-item');
for(let i=0;i<await details.count();i++){const e=details.nth(i);assert(!(await e.evaluate(x=>x.open)),'FAQ init open width '+width+' index '+i);await e.locator('summary').click();assert(await e.evaluate(x=>x.open),'FAQ not open '+width+' '+i);await e.locator('summary').click();assert(!(await e.evaluate(x=>x.open)),'FAQ not close '+width+' '+i)}
await details.first().locator('summary').focus();await page.keyboard.press('Enter');
assert(await details.first().evaluate(x=>x.open),'Keyboard Enter open failed '+width);
await page.keyboard.press('Enter');assert(!(await details.first().evaluate(x=>x.open)),'Keyboard Enter close failed '+width);
const report={width,http:response.status(),...result,errors,bad};
all.push(report);
assert(report.http===200,'HTTP status '+width);
assert(report.width===report.scrollWidth,'horizontal overflow '+width);
assert(report.hero.includes('総額の目安をご案内')&&report.hero.includes('写真だけで判断できない場合は追加で確認します。')&&!report.hero.includes('最終総額'),'Old hero after deploy '+width);
assert(JSON.stringify(report.faq)===JSON.stringify(sourceFaq),'Source/live FAQ mismatch '+width);
assert(report.faqCss==='none','FAQ shadow still present '+width);
assert(report.images.length===3&&report.images.every(e=>e.loaded),'Image failure '+width);
assert(report.line.length===7&&report.tel.length===5,'CTA count changed '+width);
assert(JSON.stringify(report.prices)===JSON.stringify(['6畳用','8畳用','10畳用','14畳用']),'Price plan count changed '+width);
assert(!report.missingAnchors.length&&!report.outOfBounds.length,'Out of bounds/anchor '+width);
assert(!report.errors.length&&!report.bad.length,'JS/HTTP error '+width);
await ctx.close();
}
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(all,null,2));
console.log('MI_BCS_PRODUCTION_QA_PASS '+JSON.stringify(all.map(r=>({width:r.width,http:r.http,height:r.height,faqs:r.faq.length,images:r.images.length,line:r.line.length,tel:r.tel.length,errors:r.errors.length,bad:r.bad.length,pass:true}))));
}finally{await browser.close();}
})().catch(e=>{console.error('MI_BCS_PRODUCTION_QA_FAIL',e);process.exit(1)});