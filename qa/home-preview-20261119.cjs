const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),{chromium}=require('playwright');
const root=process.cwd(),out=path.resolve('qa-home');fs.mkdirSync(out,{recursive:true});
const stage=fs.readFileSync('index.html','utf8'),base=cp.execFileSync('git',['show','origin/main:index.html'],{encoding:'utf8'});
const assert=(v,m)=>{if(!v)throw Error(m)};
const anchors=s=>[...s.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(x=>x[1]);
const oldLinks=anchors(base),newLinks=anchors(stage);assert(newLinks.length===oldLinks.length+1,'link count');assert(JSON.stringify(newLinks.filter(v=>v!=='/prices/'))===JSON.stringify(oldLinks),'prior links changed');
assert([...base.matchAll(/<script\b[\s\S]*?<\/script>/g)].map(x=>x[0]).join('')===[...stage.matchAll(/<script\b[\s\S]*?<\/script>/g)].map(x=>x[0]).join(''),'scripts changed');
const ctype={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
function serve(isStage,port){return new Promise((resolve,reject)=>{const srv=http.createServer((req,res)=>{
const p=decodeURIComponent(new URL(req.url,'http://local').pathname);
if(p==='/'||p==='/index.html'){res.writeHead(200,{'Content-Type':ctype['.html']});return res.end(isStage?stage:base)}
const file=path.resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end()};res.writeHead(200,{'Content-Type':ctype[path.extname(file)]||'application/octet-stream'});res.end(data)})
});srv.listen(port,'127.0.0.1',()=>resolve(srv)).on('error',reject);})}
async function examine(browser,label,port,width){const ctx=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});const page=await ctx.newPage(),errors=[],bad=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:'+port)&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:'+port+'/')?r.continue():r.abort('blockedbyclient'));
const http=await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded',timeout:45000});
await page.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});
const first=await page.evaluate(()=>{const ids=new Set([...document.querySelectorAll('[id]')].map(x=>x.id));
return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
lead:document.querySelector('.hero-lead')?.innerText,
priceLink:[...document.querySelectorAll('a[href="/prices/"]')].map(e=>({label:e.textContent.trim(),rect:e.getBoundingClientRect().toJSON()})),
images:[...document.images].map(e=>({src:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0})),
line:[...document.querySelectorAll('a[href*="lin.ee"]')].map(e=>e.getAttribute('href')),
tel:[...document.querySelectorAll('a[href^="tel:"]')].map(e=>e.getAttribute('href')),
faq:document.querySelectorAll('#faq details.faq-item').length,
badAnchors:[...document.querySelectorAll('a[href^="#"]')].map(e=>e.getAttribute('href').slice(1)).filter(id=>id&&!ids.has(id)),
outOfBounds:[...document.querySelectorAll('h1,h2,h3,p,a,button,summary')].filter(e=>e.getClientRects().length).map(e=>({t:(e.textContent||'').slice(0,35),r:e.getBoundingClientRect()})).filter(x=>x.r.width>0&&(x.r.left<-4||x.r.right>innerWidth+4)).slice(0,10)};});
await page.screenshot({path:path.join(out,label+'-'+width+'.png'),fullPage:true,animations:'disabled',timeout:60000});
if(label==='new'){const faqs=page.locator('#faq details.faq-item');for(let i=0;i<await faqs.count();i++){const item=faqs.nth(i),initial=await item.evaluate(e=>e.open);await item.locator('summary').click();assert(await item.evaluate(e=>e.open)!==initial,'faq toggle '+i+' '+width);await item.locator('summary').click();assert(await item.evaluate(e=>e.open)===initial,'faq restore '+i+' '+width);}}
await ctx.close();return {http:http.status(),...first,errors,bad};}
(async()=>{let s0,s1,b;try{s0=await serve(false,8766);s1=await serve(true,8765);b=await chromium.launch({channel:'chrome',headless:true});const result=[];
for(const width of [1440,390,320]){
const old=await examine(b,'before',8766,width),nu=await examine(b,'after',8765,width);
assert(old.http===200&&nu.http===200,'http '+width);assert(nu.width===nu.scrollWidth,'scroll '+width);
assert(nu.lead.includes('現場経験17年の代表')&&nu.lead.includes('洗う・直す・買い替える'),'copy '+width);
assert(old.priceLink.length===0&&nu.priceLink.length===1,'price guide link '+width);
assert(JSON.stringify(old.line)===JSON.stringify(nu.line)&&JSON.stringify(old.tel)===JSON.stringify(nu.tel),'existing CTA changed '+width);
assert(old.faq===6&&nu.faq===6,'FAQ count '+width);
assert(old.images.length===nu.images.length&&nu.images.every(i=>i.loaded),'image load '+width);
assert(!nu.badAnchors.length&&!nu.outOfBounds.length&&!nu.errors.length&&!nu.bad.length,'layout/assets '+width);
result.push({width,http:nu.http,images:nu.images.length,faq:nu.faq,line:nu.line.length,tel:nu.tel.length,priceGuide:nu.priceLink.length,errors:0,pass:true});}
console.log('HOME_PREVIEW_PASS '+JSON.stringify(result));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));
}finally{if(b)await b.close();if(s0)await new Promise(r=>s0.close(r));if(s1)await new Promise(r=>s1.close(r))}})().catch(e=>{console.error('HOME_PREVIEW_FAIL',e);process.exit(1)});
