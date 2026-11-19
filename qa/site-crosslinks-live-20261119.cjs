const fs=require('fs'),path=require('path'),{chromium}=require('playwright'),origin='https://teruya1229.github.io',out='qa-crosslink-live-20261119';
fs.mkdirSync(out,{recursive:true});const must=(v,e)=>{if(!v)throw Error(e)};
const pages=[{path:'/',name:'home',images:20,faq:6,line:4,tel:5},{path:'/house-cleaning/',name:'house',images:18,faq:10,line:9,tel:1},{path:'/cursor-test/',name:'aircon-family',images:21,faq:12,line:13,tel:3}];
const core=['/','/moving/','/business-cleaning/','/aircon/','/house-cleaning/','/toilet/','/reform/','/washlet/','/lighting/','/mi-bcs/aircon-replacement/','/mi-bcs/','/prices/','/cursor-test/','/cursor-test/nanjo.html','/cursor-test/naha.html','/cursor-test/yaese.html','/cursor-test/haebaru.html','/cursor-test/yonabaru.html','/cursor-test/tomigusuku.html','/cursor-test/itoman.html','/cursor-test/south.html','/cursor-test/central.html','/cursor-test/urasoe.html','/complete-disassembly/'];
(async()=>{let browser;const report=[];try{browser=await chromium.launch({channel:'chrome',headless:true});
for(const width of [1440,390,320])for(const item of pages){
const ctx=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],bad=[];
p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(origin+'/')&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await p.route('**/*',r=>{const u=r.request().url();return u.startsWith(origin+'/')||u.startsWith('data:')?r.continue():r.abort('blockedbyclient')});
let res;for(let attempt=0;attempt<6;attempt++){res=await p.goto(origin+item.path,{waitUntil:'domcontentloaded',timeout:50000});const body=await p.locator('body').textContent();const ready=item.name==='home'?body.includes('引越し・新生活のまとめ相談'):item.name==='house'?body.includes('引越し前後の清掃・家電まとめ相談'):body.includes('mi-bcs/#pricing');if(res.status()===200&&ready)break;await p.waitForTimeout(2500)}
await p.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));await p.evaluate(async()=>{await Promise.all([...document.images].map(im=>im.decode().catch(()=>{})));for(let y=0;y<document.documentElement.scrollHeight;y+=860){scrollTo(0,y);await new Promise(r=>setTimeout(r,9))}scrollTo(0,0)});
const x=await p.evaluate(()=>{const ids=[...document.querySelectorAll('a[href]')];return{h1:document.querySelector('h1')?.innerText||'',scroll:document.documentElement.scrollWidth,body:document.body.textContent||'',imgs:[...document.images].map(im=>({src:im.getAttribute('src'),ok:im.complete&&im.naturalWidth>0})),faq:document.querySelectorAll('details').length,line:ids.filter(e=>e.href.includes('lin.ee/')).map(e=>e.getAttribute('href')),tel:ids.filter(e=>e.getAttribute('href')?.startsWith('tel:')).map(e=>e.getAttribute('href')),moving:ids.filter(e=>e.getAttribute('href')==='/moving/').length,aircon:ids.filter(e=>e.getAttribute('href')==='/aircon/').length,pricing:ids.filter(e=>e.href===('https://teruya1229.github.io/mi-bcs/#pricing')).length,badLocal:ids.filter(e=>e.href.endsWith('/mi-bcs/#aircon')).length,overflow:[...document.querySelectorAll('h1,h2,h3,p,a,summary')].filter(e=>e.getClientRects().length&&!e.closest('.header-nav')).map(e=>({t:(e.textContent||'').slice(0,22),r:e.getBoundingClientRect()})).filter(x=>x.r.width>0&&(x.r.left < -8||x.r.right>innerWidth+8)).slice(0,8)}});
await p.screenshot({path:path.join(out,item.name+'-'+width+'.png'),fullPage:true,animations:'disabled',timeout:65000});
must(res.status()===200,'HTTP '+item.name+' '+width);must(x.imgs.length===item.images&&x.imgs.every(z=>z.ok),'assets '+item.name+' '+width+' '+JSON.stringify(x.imgs.filter(z=>!z.ok)));
must(x.faq===item.faq,'FAQ '+item.name+' '+width);must(x.line.length===item.line&&x.tel.length===item.tel,'CTA preserved '+item.name+' '+width);
must(x.scroll<=width&&!x.overflow.length&&!errors.length&&!bad.length,'layout '+item.name+' '+width+' '+JSON.stringify({scroll:x.scroll,overflow:x.overflow,errors,bad}));
if(item.name==='home')must(x.moving>=2&&x.aircon>=1,'home direct links '+width);
if(item.name==='house')must(x.moving===1,'house moving reciprocal '+width);
if(item.name==='aircon-family')must(x.pricing===1&&x.badLocal===0,'MI.BCS target '+width);
report.push({page:item.path,width,http:res.status(),imgs:x.imgs.length,faq:x.faq,line:x.line.length,tel:x.tel.length,moving:x.moving,aircon:x.aircon,miPricing:x.pricing,horizontalOverflow:0,errors:0,pass:true});await ctx.close();}
const hopReport=[];
for(const width of [1440,390,320]){
const ctx=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
const tasks=[{from:'/',href:'/moving/',dest:'/moving/'},{from:'/',href:'/aircon/',dest:'/aircon/'},{from:'/house-cleaning/',href:'/moving/',dest:'/moving/'},{from:'/cursor-test/',href:'https://teruya1229.github.io/mi-bcs/#pricing',dest:'/mi-bcs/',hash:'#pricing'}];
for(const item of tasks){const p=await ctx.newPage();await p.route('**/*',r=>{const u=r.request().url();return u.startsWith(origin+'/')||u.startsWith('data:')?r.continue():r.abort('blockedbyclient')});await p.goto(origin+item.from,{waitUntil:'domcontentloaded',timeout:50000});const a=p.locator('a[href="'+item.href+'"]').first();must(await a.count()===1,'missing click src '+width+' '+item.href);
await a.click({timeout:25000});await p.waitForURL(url=>url.pathname===item.dest&&(!item.hash||url.hash===item.hash),{timeout:45000});
must(await p.locator('main').count()>=1,'missing destination main '+item.dest);
if(item.hash)must(await p.locator('#pricing').count()===1,'MI pricing section missing');
const r=await p.request.get(origin+item.dest,{timeout:30000});must(r.status()===200,'link live HTTP200 '+item.dest+' '+r.status());
hopReport.push({width,from:item.from,link:item.href,result:p.url(),http:r.status(),pass:true});await p.close();}
await ctx.close();}
const ctx=await browser.newContext(),p=await ctx.newPage();const status=await Promise.all(core.map(async u=>{try{const r=await p.request.get(origin+u,{timeout:30000});return{route:u,http:r.status()}}catch(e){return{route:u,error:String(e)}}}));await ctx.close();
must(status.every(x=>x.http===200),'24 core route HTTP status '+JSON.stringify(status.filter(x=>x.http!==200)));
console.log('SITE_FINAL_PAGES_PASS '+JSON.stringify(report));console.log('SITE_FINAL_CLICKS_PASS '+JSON.stringify(hopReport));console.log('SITE_FINAL_CORE_HTTP_PASS '+JSON.stringify({count:status.length,bad:status.filter(x=>x.http!==200),pass:true}));
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({pages:report,clicks:hopReport,core:status},null,2));
}finally{if(browser)await browser.close()}})().catch(e=>{console.error('SITE_FINAL_FAIL',e);process.exit(1)});