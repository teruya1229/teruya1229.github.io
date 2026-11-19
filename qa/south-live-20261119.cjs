const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const url='https://teruya1229.github.io/cursor-test/south.html',dir='qa-south-live-20261119';fs.mkdirSync(dir,{recursive:true});
const must=(ok,why)=>{if(!ok)throw Error(why)};const cities=['nanjo','yaese','haebaru','yonabaru','tomigusuku','itoman','naha'];
(async()=>{let browser;const reports=[];try{browser=await chromium.launch({channel:'chrome',headless:true});
for(const width of [1440,390,320]){const ctx=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],bad=[];
p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith('https://teruya1229.github.io/')&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await p.route('**/*',route=>{const u=route.request().url();return u.startsWith('https://teruya1229.github.io/')||u.startsWith('data:')?route.continue():route.abort('blockedbyclient')});
let res;for(let attempt=0;attempt<6;attempt++){res=await p.goto(url,{waitUntil:'domcontentloaded',timeout:45000});const ready=await p.locator('body').textContent();if(res.status()===200&&ready.includes('迷ったら写真で相談')&&ready.includes('Googleマップで口コミを見る'))break;await p.waitForTimeout(2500);}
await p.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
await p.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));for(let y=0;y<document.documentElement.scrollHeight;y+=860){scrollTo(0,y);await new Promise(r=>setTimeout(r,10))}scrollTo(0,0)});
const x=await p.evaluate((cities)=>{
const region=document.querySelector('.south-area-list'),grid=region?getComputedStyle(region):null,tel=document.querySelector('.header-tel'),tr=tel?tel.getBoundingClientRect():null;
return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
h1:document.querySelector('h1')?.innerText||'',hero:document.querySelector('.hero-inner')?.innerText||'',content:document.body.textContent||'',
images:[...document.images].map(i=>({src:i.getAttribute('src'),ok:i.complete&&i.naturalWidth>0})),
faq:document.querySelectorAll('section.faq details.faq-details').length,areas:cities.map(c=>({name:c,exists:!!document.querySelector('a[href="'+c+'.html"]')})),
columns:grid?grid.gridTemplateColumns.split(' ').length:0,areaCount:region?region.querySelectorAll('.reason-item').length:0,
lines:[...document.querySelectorAll('a[href*="lin.ee"]')].map(e=>e.getAttribute('href')),phones:[...document.querySelectorAll('a[href^="tel:"]')].map(e=>e.getAttribute('href')),phoneHeight:tr?tr.height:0,
quotes:document.querySelectorAll('.voice-item').length,oldQuote:document.body.innerText.includes('南城市・30代　エアコンクリーニング'),newQuote:document.body.innerText.includes('匿名カズさん・2026年4月22日'),googleLink:!!document.querySelector('.south-review-link[href*="google.com/maps/"]'),
tracking:!!document.querySelector('script[src*="gtag/js?id=G-X8LKLFDL3G"]'),firstCTA:document.querySelector('a[data-cta-location="south-fv"]')?.getAttribute('href'),
overflows:[...document.querySelectorAll('h1,h2,h3,h4,p,a,summary')].filter(e=>e.getClientRects().length&&!e.closest('.header-nav')).map(e=>({text:(e.textContent||'').slice(0,23),r:e.getBoundingClientRect()})).filter(v=>v.r.width>0&&(v.r.left < -6||v.r.right>innerWidth+6)).slice(0,7)};
},cities);
await p.screenshot({path:path.join(dir,'south-'+width+'.png'),fullPage:true,animations:'disabled',timeout:60000});
must(res.status()===200,'HTTP '+width);
must(x.h1.includes('沖縄南部7市町')&&x.hero.includes('写真と型番')&&x.hero.includes('14,000'),'FV '+width);
must(x.images.length===4&&x.images.every(z=>z.ok),'image '+width);
must(x.faq===6,'FAQ6 '+width);
must(x.areas.every(z=>z.exists)&&x.areaCount===7&&x.columns===(width>720?2:1),'area nav '+width+' '+x.columns);
must(x.lines.length===6&&x.lines.every(h=>h==='https://lin.ee/tsilra6')&&x.firstCTA==='https://lin.ee/tsilra6','LINE '+width);
must(x.phones.length===2&&x.phones.every(h=>h==='tel:05017241338')&&x.phoneHeight<70,'phone '+width+' '+x.phoneHeight);
must(x.quotes===1&&!x.oldQuote&&x.newQuote&&x.googleLink,'review '+width);
must(x.content.includes('200世帯達成まで')&&x.content.includes('8,000円')&&x.content.includes('14,000円')&&x.content.includes('15,000円'),'pricing '+width);
must(x.tracking,'GA4 '+width);
must(x.scrollWidth<=width&&!x.overflows.length&&!errors.length&&!bad.length,'layout '+width+' '+JSON.stringify({errors,bad,overflows:x.overflows}));
if(width===1440){for(const c of cities){const q=await p.request.get('https://teruya1229.github.io/cursor-test/'+c+'.html',{timeout:25000});must(q.status()===200,'city http '+c+' '+q.status());}}
const faqs=p.locator('section.faq details.faq-details');for(let i=0;i<await faqs.count();i++){const e=faqs.nth(i),v=await e.evaluate(el=>el.open);await e.locator('summary').click();must((await e.evaluate(el=>el.open))!==v,'FAQ toggle '+i+' '+width);await e.locator('summary').click();must((await e.evaluate(el=>el.open))===v,'FAQ restore '+i+' '+width)}
reports.push({width,http:res.status(),images:x.images.length,faq:x.faq,areaLinks:x.areaCount,columns:x.columns,line:x.lines.length,phone:x.phones.length,phoneHeight:Math.round(x.phoneHeight),errors:errors.length,overflow:0,pass:true});await ctx.close();}
console.log('SOUTH_LIVE_PASS '+JSON.stringify(reports));fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(reports,null,2));
}finally{if(browser)await browser.close()}})().catch(e=>{console.error('SOUTH_LIVE_FAIL',e);process.exit(1)});