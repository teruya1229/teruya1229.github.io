const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const url='https://teruya1229.github.io/cursor-test/central.html',out='qa-central-live-20261119';fs.mkdirSync(out,{recursive:true});
const assert=(v,msg)=>{if(!v)throw Error(msg)};const ids=['沖縄市','宜野湾市','うるま市','北谷町','嘉手納町','読谷村','北中城村','中城村'];
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});const reports=[];try{
for(const width of [1440,390,320]){const ctx=await b.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],bad=[];
p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith('https://teruya1229.github.io/')&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await p.route('**/*',r=>{const url=r.request().url();return url.startsWith('https://teruya1229.github.io/')||url.startsWith('data:')?r.continue():r.abort('blockedbyclient')});
let response;for(let i=0;i<8;i++){response=await p.goto(url,{waitUntil:'domcontentloaded',timeout:50000});const body=await p.locator('body').textContent();if(response.status()===200&&body.includes('沖縄中部のご家庭へ')&&body.includes('Googleマップで確認'))break;await p.waitForTimeout(2500);}
await p.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
await p.evaluate(async()=>{await Promise.all([...document.images].map(im=>im.decode().catch(()=>{})));for(let y=0;y<document.documentElement.scrollHeight;y+=900){scrollTo(0,y);await new Promise(r=>setTimeout(r,7))}scrollTo(0,0)});
const x=await p.evaluate(ids=>{
const hero=document.querySelector('.hero'),mid=document.getElementById('mid-cta'),first=document.querySelector('h1 span'),area=document.querySelector('.central-area-list'),cs=area?getComputedStyle(area):null;
return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,heroTop:hero?hero.getBoundingClientRect().top+scrollY:-1,midTop:mid?mid.getBoundingClientRect().top+scrollY:-1,firstH:first?.getBoundingClientRect().height,firstLine:first?parseFloat(getComputedStyle(first).lineHeight):0,
heroText:document.querySelector('.hero-inner')?.innerText||'',bodyText:document.body.textContent||'',hasGoogle:!!document.querySelector('a.central-review-link[href*="google.com/maps/"]'),
images:[...document.images].map(im=>({src:im.getAttribute('src'),ok:im.complete&&im.naturalWidth>0})),
faq:document.querySelectorAll('#faq details.faq-details').length,areas:area?area.querySelectorAll('.reason-item').length:0,cols:cs?.gridTemplateColumns?.split(' ').length||0,areaNames:ids.map(id=>area?.innerText.includes(id)),
line:[...document.querySelectorAll('a[href*="lin.ee"]')].map(e=>e.getAttribute('href')),tel:[...document.querySelectorAll('a[href^="tel:"]')].map(e=>e.getAttribute('href')),reserve:[...document.querySelectorAll('a[href*="airrsv.net"]')].map(e=>e.getAttribute('href')),
reviews:document.querySelectorAll('.voice-item .voice-text').length,internalReviewLink:!!document.querySelector('a.central-review-link[href="../complete-disassembly/"]'),tracking:!!document.querySelector('script[src*="gtag/js?id=G-X8LKLFDL3G"]'),
overflow:[...document.querySelectorAll('h1,h2,h3,h4,p,a,summary')].filter(e=>e.getClientRects().length&&!e.closest('.header-nav')).map(e=>({text:(e.textContent||'').slice(0,22),r:e.getBoundingClientRect()})).filter(q=>q.r.width>0&&(q.r.left < -6||q.r.right>innerWidth+6)).slice(0,8)};},ids);
await p.screenshot({path:path.join(out,'central-'+width+'.png'),fullPage:true,animations:'disabled',timeout:60000});
assert(response.status()===200,'HTTP '+width);
assert(x.heroTop>=0&&x.heroTop<180&&x.midTop>x.heroTop+500,'hero order '+width+' '+JSON.stringify({hero:x.heroTop,mid:x.midTop}));
assert(x.firstH<=x.firstLine+2,'header wrapping '+width);
assert(x.heroText.includes('通常分解か完全分解か迷ったら')&&x.heroText.includes('9,000円'),'FV copy '+width);
assert(x.images.length===21&&x.images.every(q=>q.ok),'images '+width+' '+JSON.stringify(x.images.filter(q=>!q.ok)));
assert(x.faq===9,'FAQ9 '+width);
assert(x.areas===8&&x.areaNames.every(Boolean)&&x.cols===(width>720?2:1),'area layout '+width);
assert(x.line.length===14&&x.line.every(h=>h==='https://lin.ee/tsilra6'),'LINE unchanged '+width);
assert(x.tel.length===5&&x.tel.every(h=>h==='tel:05017241338'),'phone unchanged '+width);
assert(x.reserve.length===4&&x.reserve.every(h=>h==='https://airrsv.net/bc-servicesokinawa/calendar'),'reserve unchanged '+width);
assert(x.reviews===4&&x.internalReviewLink&&x.hasGoogle,'review provenance '+width);
assert(x.tracking,'GA4 present '+width);
assert(x.bodyText.includes('15,000円')&&x.bodyText.includes('16,000円')&&!x.bodyText.includes('Google口コミ 5.0 ★★★★★（13件）')&&!x.bodyText.includes('最近は、カビの再発防止'),'fees and claims '+width);
assert(x.scrollWidth<=width&&!x.overflow.length&&!errors.length&&!bad.length,'overflow/JS '+width+' '+JSON.stringify({overflow:x.overflow,bad,errors}));
if(width===1440){for(const u of ['south.html','urasoe.html','cases.html','faq.html']){const r=await p.request.get('https://teruya1229.github.io/cursor-test/'+u,{timeout:25000});assert(r.status()===200,'related page '+u+':'+r.status())}}
const faq=p.locator('#faq details.faq-details');for(let i=0;i<await faq.count();i++){const d=faq.nth(i),v=await d.evaluate(e=>e.open);await d.locator('summary').click();assert((await d.evaluate(e=>e.open))!==v,'FAQ toggle '+width+','+i);await d.locator('summary').click();assert((await d.evaluate(e=>e.open))===v,'FAQ restore '+width+','+i)}
reports.push({width,http:response.status(),imgs:x.images.length,faqs:x.faq,area:x.areas,columns:x.cols,line:x.line.length,tel:x.tel.length,airreserve:x.reserve.length,reviews:x.reviews,overflow:0,errors:0,pass:true});await ctx.close();}
console.log('CENTRAL_LIVE_PASS '+JSON.stringify(reports));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(reports,null,2));
}finally{await b.close()}})().catch(e=>{console.error('CENTRAL_LIVE_FAIL',e);process.exit(1)});