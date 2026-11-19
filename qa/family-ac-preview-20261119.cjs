const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),{chromium}=require('playwright');
const root=process.cwd(),out=path.resolve('qa-family-aircon');fs.mkdirSync(out,{recursive:true});
const current=fs.readFileSync('cursor-test/index.html','utf8'),old=cp.execFileSync('git',['show','origin/main:cursor-test/index.html'],{encoding:'utf8'});
const assert=(v,m)=>{if(!v)throw Error(m)};
const urlList=s=>[...s.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(x=>x[1]);const amt=s=>[...s.matchAll(/[\d,]+円(?:〜|～)?/g)].map(x=>x[0]);const scripts=s=>[...s.matchAll(/<script\b[\s\S]*?<\/script>/g)].map(x=>x[0]);
assert(JSON.stringify(urlList(old))===JSON.stringify(urlList(current)),'Links changed');
assert(JSON.stringify(amt(old))===JSON.stringify(amt(current)),'Prices changed');
assert(JSON.stringify(scripts(old))===JSON.stringify(scripts(current)),'Tracking/scripts changed');
const start=s=>s.slice(s.indexOf('<!-- お客様の声'),s.indexOf('<!-- 梅雨明け前'));
assert(start(old)===start(current),'Reviews changed');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.mp4':'video/mp4'};
function serve(stage,port){return new Promise((resolve,reject)=>{const srv=http.createServer((req,res)=>{
const p=decodeURIComponent(new URL(req.url,'http://local').pathname);
if(p==='/cursor-test/'||p==='/cursor-test/index.html'){res.writeHead(200,{'Content-Type':types['.html']});return res.end(stage?current:old)}
const file=path.resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
fs.readFile(file,(e,d)=>{if(e){res.writeHead(404);return res.end()};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(d)})});
srv.listen(port,'127.0.0.1',()=>resolve(srv)).on('error',reject)})}
async function visit(browser,label,port,width){const ctx=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[],bad=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:'+port)&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:'+port+'/')?r.continue():r.abort('blockedbyclient'));
const http=await page.goto('http://127.0.0.1:'+port+'/cursor-test/',{waitUntil:'domcontentloaded',timeout:45000});
await page.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));for(let y=0;y<document.documentElement.scrollHeight;y+=800){scrollTo(0,y);await new Promise(r=>setTimeout(r,10))}scrollTo(0,0)});
const d=await page.evaluate(()=>{const ids=new Set([...document.querySelectorAll('[id]')].map(e=>e.id));const canCount=['現在：','残り ','次の応援企画も準備中','200世帯達成後は洗濯機'];
return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
markupText:document.body.innerText,
images:[...document.images].map(e=>({src:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0})),
line:[...document.querySelectorAll('a[href*="lin.ee"]')].map(e=>e.getAttribute('href')),
tel:[...document.querySelectorAll('a[href^="tel:"]')].map(e=>e.getAttribute('href')),
faq:document.querySelectorAll('#faq details.faq-details').length,
detail:document.querySelectorAll('details').length,
links:[...document.querySelectorAll('a[href]')].map(e=>e.getAttribute('href')),
missingAnchors:[...document.querySelectorAll('a[href^="#"]')].map(e=>e.getAttribute('href').slice(1)).filter(x=>x&&!ids.has(x)),
outOfBounds:[...document.querySelectorAll('h1,h2,h3,h4,p,a,summary')].filter(e=>e.getClientRects().length).map(e=>({t:(e.textContent||'').slice(0,25),r:e.getBoundingClientRect()})).filter(x=>x.r.width>0&&(x.r.left < -5||x.r.right>innerWidth+5)).slice(0,10),
stale:canCount.map(term=>({term,exists:document.body.innerText.includes(term)})),
campaignPresent:document.body.innerText.includes('200世帯達成まで')};});
delete d.markupText;
await page.screenshot({path:path.join(out,label+'-'+width+'.png'),fullPage:true,animations:'disabled',timeout:60000});
if(label==='after'){const faq=page.locator('#faq details.faq-details');for(let i=0;i<await faq.count();i++){const e=faq.nth(i),x=await e.evaluate(y=>y.open);await e.locator('summary').click();assert(await e.evaluate(y=>y.open)!==x,'FAQ toggle '+i+' width '+width);await e.locator('summary').click();assert(await e.evaluate(y=>y.open)===x,'FAQ restore '+i+' width '+width)}}
await ctx.close();return {http:http.status(),...d,errors,bad}}
(async()=>{let s0,s1,b;try{s0=await serve(false,8766);s1=await serve(true,8765);b=await chromium.launch({channel:'chrome',headless:true});const results=[];
for(const w of [1440,390,320]){const before=await visit(b,'before',8766,w),after=await visit(b,'after',8765,w);
assert(before.http===200&&after.http===200,'HTTP '+w);assert(after.width===after.scrollWidth,'Scroll '+w);
assert(before.stale.some(x=>x.exists)&&after.stale.every(x=>!x.exists),'Stale unverified banner remains '+w);
assert(after.campaignPresent,'active 200 households deal disappeared '+w);
assert(JSON.stringify(before.line)===JSON.stringify(after.line)&&JSON.stringify(before.tel)===JSON.stringify(after.tel),'CTA changed '+w);
assert(JSON.stringify(before.links)===JSON.stringify(after.links),'Links changed '+w);
assert(before.images.length===after.images.length&&after.images.every(x=>x.loaded),'Images missing '+w);
assert(after.faq===9&&after.detail===12,'FAQ/details regression '+w);
assert(!after.missingAnchors.length&&!after.outOfBounds.length&&!after.errors.length&&!after.bad.length,'layout/js/local '+w);
results.push({width:w,http:after.http,oldHeight:before.height,newHeight:after.height,images:after.images.length,faq:after.faq,details:after.detail,line:after.line.length,tel:after.tel.length,pass:true});}
console.log('FAMILY_AIRCON_PREVIEW_PASS '+JSON.stringify(results));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));
}finally{if(b)await b.close();if(s0)await new Promise(r=>s0.close(r));if(s1)await new Promise(r=>s1.close(r))}})().catch(e=>{console.error('FAMILY_AIRCON_PREVIEW_FAIL',e);process.exit(1)});