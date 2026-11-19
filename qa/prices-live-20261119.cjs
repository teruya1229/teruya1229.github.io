const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const url='https://teruya1229.github.io/prices/',out='qa-prices-live';
fs.mkdirSync(out,{recursive:true});
const src=fs.readFileSync('prices/index.html','utf8'),expectedCardCount={home:8,business:4};
const expectTxt='料金の目安から探せます。';
const assert=(v,m)=>{if(!v)throw Error(m)};
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true}),summary=[];
try{for(const w of [1440,390,320]){
const ctx=await b.newContext({viewport:{width:w,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
const page=await ctx.newPage(),errors=[],bad=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith('https://teruya1229.github.io/')&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await page.route('**/*',r=>{const u=r.request().url();return (u.startsWith('https://teruya1229.github.io/')||u.startsWith('data:'))?r.continue():r.abort('blockedbyclient')});
const resp=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
await page.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));await page.evaluate(async()=>{await Promise.all([...document.images].map(e=>e.decode().catch(()=>{})))});
const home=await page.evaluate(()=>({visible:!document.querySelector('#panel-home').hidden,cards:[...document.querySelectorAll('#panel-home .price-card')].map(e=>({title:e.querySelector('h4')?.textContent?.trim(),amount:e.querySelector('.price')?.textContent?.trim(),link:e.querySelector('a.detail-link')?.getAttribute('href')}))}));
await page.screenshot({path:path.join(out,'home-'+w+'.png'),fullPage:true,animations:'disabled',timeout:60000});
await page.locator('#tab-business').click();
const biz=await page.evaluate(()=>({visible:!document.querySelector('#panel-business').hidden,homeHidden:document.querySelector('#panel-home').hidden,cards:[...document.querySelectorAll('#panel-business .price-card')].map(e=>({title:e.querySelector('h4')?.textContent?.trim(),amount:e.querySelector('.price')?.textContent?.trim(),link:e.querySelector('a.detail-link')?.getAttribute('href')}))}));
await page.screenshot({path:path.join(out,'business-'+w+'.png'),fullPage:true,animations:'disabled',timeout:60000});
await page.locator('#tab-business').focus();await page.keyboard.press('ArrowLeft');
const state=await page.evaluate(()=>{
const ids=new Set([...document.querySelectorAll('[id]')].map(e=>e.id));
return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,h1:document.querySelector('h1')?.innerText,lead:document.querySelector('.hero-lead')?.innerText,
gradient:getComputedStyle(document.querySelector('.hero')).backgroundImage,ring:getComputedStyle(document.querySelector('.hero'),'::after').display,icons:getComputedStyle(document.querySelector('.service-symbol')).display,
selected:document.querySelector('#tab-home').getAttribute('aria-selected'),images:[...document.images].map(e=>e.complete&&e.naturalWidth>0),
links:[...document.querySelectorAll('a[href]')].map(e=>e.getAttribute('href')),
missing:[...document.querySelectorAll('a[href^="#"]')].map(e=>e.getAttribute('href').slice(1)).filter(x=>x&&!ids.has(x)),
outOfBounds:[...document.querySelectorAll('h1,h2,h3,h4,p,a,button')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&(r.left< -4||r.right>innerWidth+4)).length};
});
assert(resp.status()===200,'http '+w);assert(state.width===state.scrollWidth,'scroll '+w);
assert(state.h1.includes(expectTxt)&&state.lead.includes('相談方法へお進み'),'copy '+w);
assert(state.gradient==='none'&&state.ring==='none'&&state.icons==='none','design '+w);
assert(home.visible&&biz.visible&&biz.homeHidden&&state.selected==='true','tab behavior '+w);
assert(home.cards.length===8&&biz.cards.length===4,'count '+w);
assert(state.images.length===1&&state.images.every(Boolean),'image '+w);
assert(!state.missing.length&&!state.outOfBounds&&!errors.length&&!bad.length,'errors '+w);
assert(home.cards[0].amount.includes('8,000')&&home.cards[1].amount.includes('14,000')&&home.cards[2].amount.includes('13,000')&&home.cards[5].amount.includes('88,800')&&home.cards[6].amount.includes('14,300'),'prices '+w);
const s={width:w,http:resp.status(),home:home.cards.length,business:biz.cards.length,images:state.images.length,links:state.links.length,jsErrors:errors.length,bad:bad.length,pass:true};summary.push(s);
await ctx.close();
}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(summary,null,2));console.log('PRICES_LIVE_PASS '+JSON.stringify(summary));
}finally{await b.close()}})().catch(e=>{console.error('PRICES_LIVE_FAIL',e);process.exit(1)});
