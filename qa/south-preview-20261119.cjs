const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),{chromium}=require('playwright');
const root=process.cwd(),target='cursor-test/south.html',out='qa-south-preview-20261119';fs.mkdirSync(out,{recursive:true});
const before=cp.execFileSync('git',['show','origin/main:'+target],{encoding:'utf8'}),after=fs.readFileSync(target,'utf8');
const assert=(x,m)=>{if(!x)throw Error(m)};
const attr=(s,re)=>[...s.matchAll(re)].map(m=>m[1]||m[0]);
const oldHref=attr(before,/\bhref="([^"]+)"/g),newHref=attr(after,/\bhref="([^"]+)"/g);
for(const href of oldHref)assert(newHref.includes(href),'existing href missing: '+href);
assert(newHref.includes('../complete-disassembly/'),'verified source link');
assert(after.includes('Googleマップで口コミを見る'),'source navigation');
assert(!after.includes('"aggregateRating"'),'remove volatile review markup');
assert(!after.includes('南城市・30代　エアコンクリーニング'),'remove uncited testimonial');
assert(after.includes('匿名カズさん・2026年4月22日'),'reuse verified testimonial');
const source=cp.execFileSync('git',['show','origin/main:complete-disassembly/index.html'],{encoding:'utf8'});
assert(source.includes('匿名カズさん・2026年4月22日')&&source.includes('3台、完全分解を依頼しました。'),'quote exists on canonical LP');
const prices=(s)=>new Set(attr(s,/(?:8,000|14,000|15,000|1,000)円/g));
for(const money of prices(before))assert(prices(after).has(money),'existing money removed: '+money);
const jsScripts=(s)=>[...s.matchAll(/<script\b(?![^>]*type="application\/ld\+json")[\s\S]*?<\/script>/g)].map(m=>m[0]);
assert(JSON.stringify(jsScripts(before))===JSON.stringify(jsScripts(after)),'tracking code changed');
const ld=(s)=>[...s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
const schemas=ld(after);assert(schemas.length===3&&schemas[0]['@type']==='LocalBusiness'&&!('aggregateRating' in schemas[0]),'schema rating');
assert(schemas.find(x=>x['@type']==='FAQPage').mainEntity.length===6,'FAQ schema');
for(const href of ['nanjo.html','yaese.html','haebaru.html','yonabaru.html','tomigusuku.html','itoman.html','naha.html'])assert(newHref.includes(href),'regional target lost '+href);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
function serve(stage,port){return new Promise((resolve,reject)=>{const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);if(p==='/cursor-test/south.html'){res.writeHead(200,{'Content-Type':mime['.html']});return res.end(stage?after:before)}let full=path.resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));if(!full.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(full,(e,d)=>{if(e){res.writeHead(404);return res.end()};res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream'});res.end(d)})});server.listen(port,'127.0.0.1',()=>resolve(server)).on('error',reject)})}
async function inspect(browser,stage,port,width){
const ctx=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[],bad=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:'+port+'/')&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:'+port+'/')?r.continue():r.abort('blockedbyclient'));
const res=await page.goto('http://127.0.0.1:'+port+'/cursor-test/south.html',{waitUntil:'domcontentloaded',timeout:45000});
await page.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
await page.evaluate(async()=>{await Promise.all([...document.images].map(e=>e.decode().catch(()=>{})));for(let y=0;y<document.documentElement.scrollHeight;y+=850){scrollTo(0,y);await new Promise(r=>setTimeout(r,10))}scrollTo(0,0)});
const details=await page.evaluate(()=>{
const n=document.querySelector('.south-area-list');let cs=n?getComputedStyle(n):null;
const regions=['nanjo.html','yaese.html','haebaru.html','yonabaru.html','tomigusuku.html','itoman.html','naha.html'];
return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,hero:document.querySelector('.hero-inner')?.innerText||'',h1:document.querySelector('h1')?.innerText,regions:regions.map(u=>[u,!!document.querySelector('a[href="'+u+'"]')]),cards:document.querySelectorAll('.south-area-list .reason-item').length,columns:cs?.gridTemplateColumns,cols:cs?.gridTemplateColumns?.split(' ').length||0,imgs:[...document.images].map(x=>({src:x.getAttribute('src'),ok:x.complete&&x.naturalWidth>0})),faqs:document.querySelectorAll('section.faq details.faq-details').length,links:[...document.querySelectorAll('a[href]')].map(x=>x.getAttribute('href')),line:[...document.querySelectorAll('a[href*="lin.ee"]')].map(x=>x.getAttribute('href')),tel:[...document.querySelectorAll('a[href^="tel:"]')].map(x=>x.getAttribute('href')),quotes:document.querySelectorAll('.voice-item').length,hasProof:document.querySelector('.south-review-link')!==null,oldReviewText:document.body.innerText.includes('南城市・30代　エアコンクリーニング'),overflows:[...document.querySelectorAll('h1,h2,h3,h4,p,a,summary')].filter(e=>e.getClientRects().length&&!e.closest('.header-nav')).map(e=>({text:(e.textContent||'').slice(0,24),r:e.getBoundingClientRect()})).filter(o=>o.r.width>0&&(o.r.left < -6||o.r.right>innerWidth+6)).slice(0,7),faqText:[...document.querySelectorAll('section.faq details.faq-details')].map(e=>e.innerText)}});
await page.screenshot({path:path.join(out,(stage?'after':'before')+'-'+width+'.png'),fullPage:true,animations:'disabled',timeout:60000});
if(stage){const faqs=page.locator('section.faq details.faq-details');for(let i=0;i<await faqs.count();i++){const e=faqs.nth(i),was=await e.evaluate(el=>el.open);await e.locator('summary').click();assert((await e.evaluate(el=>el.open))!==was,'FAQ toggle '+width+' '+i);await e.locator('summary').click();assert((await e.evaluate(el=>el.open))===was,'FAQ restore '+width+' '+i)}}
await ctx.close();return {http:res.status(),...details,errors,bad}}
(async()=>{let b,oldServer,newServer;try{oldServer=await serve(false,8751);newServer=await serve(true,8752);b=await chromium.launch({channel:'chrome',headless:true});const report=[];
for(const width of [1440,390,320]){const x=await inspect(b,false,8751,width),y=await inspect(b,true,8752,width);
assert(x.http===200&&y.http===200,'http '+width);
assert(x.imgs.length===4&&y.imgs.length===4&&y.imgs.every(z=>z.ok),'images '+width);
assert(x.faqs===6&&y.faqs===6,'FAQ count '+width);
assert(JSON.stringify(x.line)===JSON.stringify(y.line)&&x.line.length===6,'LINE preserved '+width);
assert(JSON.stringify(x.tel)===JSON.stringify(y.tel)&&x.tel.length===2,'phone preserved '+width);
assert(y.regions.every(z=>z[1])&&y.cards===7,'7 city pages '+width);
assert(y.cols===(width>720?2:1),'responsive region grid '+width+' '+y.columns);
assert(y.quotes===1&&y.hasProof&&!y.oldReviewText,'review source '+width);
assert(y.hero.includes('清掃・現場経験17年')&&y.hero.includes('写真と型番')&&y.hero.includes('南部応援価格'),'hero trust '+width);
assert(y.scrollWidth<=width,'page horizontal scrolling '+width);
assert(!y.errors.length&&!y.bad.length&&!y.overflows.length,'runtime errors/overflow '+width+' '+JSON.stringify({errors:y.errors,bad:y.bad,overflows:y.overflows}));
report.push({width,http:y.http,images:y.imgs.length,faq:y.faqs,regions:y.cards,columns:y.cols,line:y.line.length,tel:y.tel.length,quotes:y.quotes,horizontalOverflow:0,jsErrors:y.errors.length,pass:true});}
console.log('SOUTH_PREVIEW_PASS '+JSON.stringify(report));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
}finally{if(b)await b.close();if(oldServer)await new Promise(r=>oldServer.close(r));if(newServer)await new Promise(r=>newServer.close(r))}})().catch(e=>{console.error('SOUTH_PREVIEW_FAIL',e);process.exit(1)});