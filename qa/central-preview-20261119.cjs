const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),{chromium}=require('playwright');
const root=process.cwd(),target='cursor-test/central.html',out='qa-central-preview-20261119';fs.mkdirSync(out,{recursive:true});
const original=cp.execFileSync('git',['show','origin/main:'+target],{encoding:'utf8'}),after=fs.readFileSync(target,'utf8');
const must=(b,m)=>{if(!b)throw Error(m)};
const links=s=>[...s.matchAll(/\bhref="([^"]+)"/g)].map(x=>x[1]);
for(const url of links(original))must(links(after).includes(url),'old URL removed '+url);
const priceSet=z=>new Set([...z.matchAll(/[\d,]+円(?:〜|～)?/g)].map(x=>x[0]));for(const v of priceSet(original))must(priceSet(after).has(v),'price removed '+v);
const scripts=z=>[...z.matchAll(/<script\b(?![^>]*type="application\/ld\+json")[\s\S]*?<\/script>/g)].map(x=>x[0]);must(JSON.stringify(scripts(original))===JSON.stringify(scripts(after)),'GA4 or JS changed');
const schemas=z=>[...z.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(x=>JSON.parse(x[1]));const schema=schemas(after),faqSchema=schema.find(x=>x['@type']==='FAQPage');
must(faqSchema&&faqSchema.mainEntity.length===9,'FAQ structured data');
must(after.includes('通常分解か完全分解か迷ったら')&&!after.includes('最近は、カビの再発防止'),'hero/recovery copy');
must(!after.includes('Google口コミ 5.0 ★★★★★（13件）'),'stale rating');must(after.includes('Googleマップで確認'),'review source');
must(after.includes('同じ口コミを掲載している完全分解LP'),'previous verified quote linked');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
function serve(phase,port){return new Promise((resolve,reject)=>{const srv=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);if(p==='/cursor-test/central.html'){res.writeHead(200,{'Content-Type':types['.html']});return res.end(phase?after:original)}const name=path.resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));if(!name.startsWith(root+path.sep)){res.writeHead(403);return res.end()};fs.readFile(name,(e,d)=>{if(e){res.writeHead(404);return res.end()};res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream'});res.end(d)})});srv.listen(port,'127.0.0.1',()=>resolve(srv)).on('error',reject)})}
async function shot(browser,phase,port,width){
const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],bad=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:'+port+'/')&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:'+port+'/')?r.continue():r.abort('blockedbyclient'));
const response=await page.goto('http://127.0.0.1:'+port+'/cursor-test/central.html',{waitUntil:'domcontentloaded',timeout:45000});
await page.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
await page.evaluate(async()=>{await Promise.all([...document.images].map(x=>x.decode().catch(()=>{})));for(let y=0;y<document.documentElement.scrollHeight;y+=900){scrollTo(0,y);await new Promise(r=>setTimeout(r,7))}scrollTo(0,0)});
const result=await page.evaluate(()=>{
const grid=document.querySelector('.central-area-list'),cs=grid?getComputedStyle(grid):null; const heroEl=document.querySelector('.hero'),middleEl=document.getElementById('mid-cta');
return {scroll:document.documentElement.scrollWidth,width:innerWidth,height:document.documentElement.scrollHeight,heroTop:heroEl?heroEl.getBoundingClientRect().top+scrollY:-1,midTop:middleEl?middleEl.getBoundingClientRect().top+scrollY:-1,hero:document.querySelector('.hero-inner')?.innerText||'',trust:document.querySelector('.trust-block')?.innerText||'',google:!!document.querySelector('.central-review-link[href*="google.com/maps/"]'),
areas:grid?.querySelectorAll('.reason-item').length||0,columns:cs?.gridTemplateColumns?.split(' ').length||0,faqs:document.querySelectorAll('#faq details.faq-details').length,
imgs:[...document.images].map(x=>({src:x.getAttribute('src'),ok:x.complete&&x.naturalWidth>0})),
line:[...document.querySelectorAll('a[href*="lin.ee"]')].map(x=>x.getAttribute('href')),
tel:[...document.querySelectorAll('a[href^="tel:"]')].map(x=>x.getAttribute('href')),
reserve:[...document.querySelectorAll('a[href*="airrsv.net"]')].map(x=>x.getAttribute('href')),
hrefs:[...document.querySelectorAll('a[href]')].map(x=>x.getAttribute('href')),
quotes:[...document.querySelectorAll('.voice-item .voice-text')].map(x=>x.textContent.trim()),
tracking:!!document.querySelector('script[src*="gtag/js?id=G-X8LKLFDL3G"]'),
overflow:[...document.querySelectorAll('h1,h2,h3,h4,p,a,summary')].filter(e=>e.getClientRects().length&&!e.closest('.header-nav')).map(e=>({text:(e.textContent||'').slice(0,25),r:e.getBoundingClientRect()})).filter(o=>o.r.width>0&&(o.r.left < -6||o.r.right>innerWidth+6)).slice(0,9)}});
await page.screenshot({path:path.join(out,(phase?'after':'before')+'-'+width+'.png'),fullPage:true,animations:'disabled',timeout:60000});
if(phase){const faqs=page.locator('#faq details.faq-details');for(let i=0;i<await faqs.count();i++){const el=faqs.nth(i),was=await el.evaluate(x=>x.open);await el.locator('summary').click();must((await el.evaluate(x=>x.open))!==was,'FAQ click '+i+' '+width);await el.locator('summary').click();must((await el.evaluate(x=>x.open))===was,'FAQ restore '+i+' '+width);}}
await context.close();return{http:response.status(),...result,errors,bad}};
(async()=>{let serverBefore,serverAfter,b;try{serverBefore=await serve(0,8731);serverAfter=await serve(1,8732);b=await chromium.launch({channel:'chrome',headless:true});const output=[];
for(const width of [1440,390,320]){const x=await shot(b,0,8731,width),y=await shot(b,1,8732,width);
must(x.http===200&&y.http===200,'HTTP '+width);
must(x.imgs.length===y.imgs.length&&y.imgs.length>=20&&y.imgs.every(i=>i.ok),'image loaded '+width+' '+JSON.stringify(y.imgs.filter(i=>!i.ok)));
must(x.faqs===9&&y.faqs===9,'FAQ count '+width);
must(JSON.stringify(x.line)===JSON.stringify(y.line),'LINE unchanged '+width);
must(JSON.stringify(x.tel)===JSON.stringify(y.tel),'phone unchanged '+width);
must(JSON.stringify(x.reserve)===JSON.stringify(y.reserve),'reserve unchanged '+width);
must(x.quotes.length===y.quotes.length&&JSON.stringify(x.quotes)===JSON.stringify(y.quotes),'testimonial unchanged '+width);
must(y.google&&y.tracking&&y.hero.includes('通常分解か完全分解か迷ったら'),'trust and GA4 '+width);
must(y.areas===8&&y.columns===(width>720?2:1),'regional grid '+width+' '+y.columns);
must(y.heroTop>=0&&y.heroTop<180&&y.midTop>y.heroTop+500,'hero must be first and mid CTA must be later '+width+' '+JSON.stringify({heroTop:y.heroTop,midTop:y.midTop}));
must(y.scroll<=width&&!y.overflow.length&&!y.errors.length&&!y.bad.length,'layout '+width+' '+JSON.stringify({overflow:y.overflow,errors:y.errors,bad:y.bad}));
output.push({width,http:y.http,img:y.imgs.length,faq:y.faqs,regions:y.areas,columns:y.columns,line:y.line.length,tel:y.tel.length,reserve:y.reserve.length,reviews:y.quotes.length,overflow:0,errors:0,pass:true});}
console.log('CENTRAL_PREVIEW_PASS '+JSON.stringify(output));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(output,null,2));
}finally{if(b)await b.close();if(serverBefore)await new Promise(r=>serverBefore.close(r));if(serverAfter)await new Promise(r=>serverAfter.close(r))}})().catch(e=>{console.error('CENTRAL_PREVIEW_FAIL',e);process.exit(1)});