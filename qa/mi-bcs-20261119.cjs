const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),{chromium}=require('playwright');
const root=process.cwd(), target='mi-bcs/index.html',stage=fs.readFileSync(target,'utf8');
const base=cp.execFileSync('git',['show','origin/main:'+target],{encoding:'utf8'});
const out=path.resolve('qa-mi-bcs');fs.mkdirSync(out,{recursive:true});
function assert(flag,msg){if(!flag)throw Error(msg)}
function links(s){return [...s.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1])}
function money(s){return [...s.matchAll(/[\d,]+円(?:〜|～)?/g)].map(m=>m[0])}
function scripts(s){return [...s.matchAll(/<script\b[\s\S]*?<\/script>/g)].map(m=>m[0])}
assert(JSON.stringify(links(base))===JSON.stringify(links(stage)),'CTA and asset URLs changed');
assert(JSON.stringify(money(base))===JSON.stringify(money(stage)),'Price text changed');
assert(JSON.stringify(scripts(base))===JSON.stringify(scripts(stage)),'Analytics or script changed');
const ctype={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
function serve(isStage,port){return new Promise((resolve,reject)=>{
const server=http.createServer((req,res)=>{
try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/mi-bcs/'||pathname==='/mi-bcs/index.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(isStage?stage:base)}
  const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end()};res.writeHead(200,{'Content-Type':ctype[path.extname(file)]||'application/octet-stream'});res.end(data)})
}catch(e){res.writeHead(500);res.end()}
});server.listen(port,'127.0.0.1',()=>resolve(server)).on('error',reject);
})}
async function visit(browser,label,port,width){
const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',deviceScaleFactor:1});
const page=await context.newPage(),errors=[],bad=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:'+port) && r.status()>=400)bad.push(r.status()+' '+r.url())});
await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:'+port+'/')?route.continue():route.abort('blockedbyclient'));
const response=await page.goto('http://127.0.0.1:'+port+'/mi-bcs/',{waitUntil:'domcontentloaded',timeout:45000});
await page.locator('img').evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));
await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));for(let y=0;y<document.documentElement.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,12))}scrollTo(0,0)});
await page.waitForTimeout(250);
const stats=await page.evaluate(()=>{
const ids=new Set([...document.querySelectorAll('[id]')].map(e=>e.id));
const missingAnchors=[...document.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href').slice(1)).filter(s=>s&&!ids.has(s));
return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
images:[...document.images].map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})),
faqItems:[...document.querySelectorAll('#faq .faq-item')].map(e=>({q:(e.querySelector('h3,summary')?.textContent||'').trim(),a:(e.querySelector('p')?.textContent||'').trim()})),
details:document.querySelectorAll('#faq details.faq-item').length,
line:[...document.querySelectorAll('a[href*="lin.ee"]')].map(a=>a.href),
tel:[...document.querySelectorAll('a[href^="tel:"]')].map(a=>a.href),
hero:document.querySelector('.hero-lead')?.innerText||'',
missingAnchors,
outOfBounds:[...document.querySelectorAll('h1,h2,h3,p,a,button,summary')].filter(e=>e.getClientRects().length).map(e=>({t:(e.innerText||'').slice(0,40),r:e.getBoundingClientRect()})).filter(x=>x.r.width>0&&(x.r.left < -4 || x.r.right > innerWidth+4)).slice(0,8)
}});
await page.screenshot({path:path.join(out,label+'-'+width+'.png'),fullPage:true,animations:'disabled',timeout:60000});
if(label==='new'){
const entries=page.locator('#faq details.faq-item');
for(let i=0;i<await entries.count();i++){const f=entries.nth(i);assert(!(await f.evaluate(e=>e.open)),'init open '+i);await f.locator('summary').click();assert(await f.evaluate(e=>e.open),'did not open '+i);await f.locator('summary').click();assert(!(await f.evaluate(e=>e.open)),'did not close '+i)}
const first=entries.first(),sum=first.locator('summary');await sum.focus();await page.keyboard.press('Enter');assert(await first.evaluate(e=>e.open),'keyboard Enter failed');await page.keyboard.press('Enter');assert(!(await first.evaluate(e=>e.open)),'keyboard close failed');
}
await context.close();return {label,http:response.status(),...stats,errors,bad};
}
(async()=>{const s1=await serve(false,8766),s2=await serve(true,8765);let b;try{
b=await chromium.launch({headless:true});
const res=[];
for(const w of [1440,390,320]){
const before=await visit(b,'old',8766,w),after=await visit(b,'new',8765,w);
assert(JSON.stringify(before.faqItems)===JSON.stringify(after.faqItems),'FAQ question or answer changed '+w);
assert(before.faqItems.length===10&&after.details===10,'FAQ count '+w);
assert(before.http===200&&after.http===200,'http status '+w);
assert(before.width===before.scrollWidth&&after.width===after.scrollWidth,'horizontal overflow '+w);
assert(before.images.every(i=>i.loaded)&&after.images.every(i=>i.loaded),'images failed '+w);
assert(JSON.stringify(before.line)===JSON.stringify(after.line),'LINE changed '+w);
assert(JSON.stringify(before.tel)===JSON.stringify(after.tel),'phone changed '+w);
assert(after.hero.includes('総額の目安')&&!after.hero.includes('最終総額'),'hero guarantee remains '+w);
assert(before.missingAnchors.length===0&&after.missingAnchors.length===0,'anchor missing '+w);
assert(before.outOfBounds.length===0&&after.outOfBounds.length===0,'content out of viewport '+w);
assert(before.errors.length===0&&after.errors.length===0&&!before.bad.length&&!after.bad.length,'JS/local error '+w);
res.push({width:w,beforeHeight:before.height,afterHeight:after.height,faq:after.details,images:after.images.length,line:after.line.length,tel:after.tel.length,pass:true});
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(res,null,2));
console.log('MI_BCS_PREVIEW_QA_PASS '+JSON.stringify(res));
}finally{if(b)await b.close();await new Promise(r=>s1.close(r));await new Promise(r=>s2.close(r))}})().catch(e=>{console.error('MI_BCS_PREVIEW_QA_FAIL',e);process.exit(1)});
