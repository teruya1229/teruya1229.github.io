const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),{chromium}=require('playwright');
const root=process.cwd(),target='cursor-test/yonabaru.html',out='qa-yonabaru-preview';fs.mkdirSync(out,{recursive:true});
const before=cp.execFileSync('git',['show','origin/main:'+target],{encoding:'utf8'}),after=fs.readFileSync(target,'utf8');
const assert=(x,m)=>{if(!x)throw Error(m)};
const tokens=(s,re)=>[...s.matchAll(re)].map(m=>m[0]);
const compare={links:/\b(?:href|src)="[^"]+"/g,prices:/[\d,]+円(?:〜|～)?/g,analytics:/<script\b(?![^>]*type="application\/ld\+json")[\s\S]*?<\/script>/g};
for(const [name,re] of Object.entries(compare))assert(JSON.stringify(tokens(before,re))===JSON.stringify(tokens(after,re)),name+' changed');
assert(after.includes('通常分解で十分か、完全分解が必要か'),"why choose copy");
assert(!after.includes('カビの再発防止を重視する方におすすめ'),"anti recurrence overclaim");
assert(after.includes('分解できる範囲は機種・設置状況によって異なります'),"FAQ qualification");
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
function serve(stage,port){return new Promise((resolve,reject)=>{const s=http.createServer((req,res)=>{
const p=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
if(p==='/cursor-test/yonabaru.html'){res.writeHead(200,{'Content-Type':types['.html']});return res.end(stage?after:before)}
const full=path.resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));if(full!==root&&!full.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
fs.readFile(full,(e,d)=>{if(e){res.writeHead(404);return res.end()};res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream'});res.end(d)})});
s.listen(port,'127.0.0.1',()=>resolve(s)).on('error',reject)})}
async function inspect(browser,stage,port,w){
const ctx=await browser.newContext({viewport:{width:w,height:900},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[],bad=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:'+port)&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:'+port+'/')?route.continue():route.abort('blockedbyclient'));
const res=await page.goto('http://127.0.0.1:'+port+'/cursor-test/yonabaru.html',{waitUntil:'domcontentloaded',timeout:45000});
await page.locator('img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
await page.evaluate(async()=>{await Promise.all([...document.images].map(e=>e.decode().catch(()=>{})));for(let y=0;y<document.documentElement.scrollHeight;y+=950){scrollTo(0,y);await new Promise(r=>setTimeout(r,10))}scrollTo(0,0)});
const result=await page.evaluate(()=>{
const ids=new Set([...document.querySelectorAll('[id]')].map(e=>e.id));
return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,hero:document.querySelector('.hero-intro')?.innerText,
compare:document.querySelector('.reason-item strong')?.textContent,
faq:[...document.querySelectorAll('#faq details.faq-details')].map(e=>({question:e.querySelector('summary')?.textContent.trim(),answer:e.textContent.trim()})),
images:[...document.images].map(e=>({src:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0})),
links:[...document.querySelectorAll('a[href]')].map(e=>e.getAttribute('href')),
line:[...document.querySelectorAll('a[href*="lin.ee"]')].map(e=>e.getAttribute('href')),
tel:[...document.querySelectorAll('a[href^="tel:"]')].map(e=>e.getAttribute('href')),
anchors:[...document.querySelectorAll('a[href^="#"]')].map(e=>e.getAttribute('href').slice(1)).filter(x=>x&&!ids.has(x)),
overflow:[...document.querySelectorAll('h1,h2,h3,h4,p,a,summary')].filter(e=>e.getClientRects().length&&!e.closest('.header-nav')).map(e=>({name:(e.textContent||'').slice(0,20),r:e.getBoundingClientRect()})).filter(e=>e.r.width>0&&(e.r.left< -5||e.r.right>innerWidth+5)).slice(0,8)}});
await page.screenshot({path:path.join(out,(stage?'after':'before')+'-'+w+'.png'),fullPage:true,animations:'disabled',timeout:60000});
if(stage){const faqs=page.locator('#faq details.faq-details');for(let i=0;i<await faqs.count();i++){const x=faqs.nth(i),v=await x.evaluate(e=>e.open);await x.locator('summary').click();assert((await x.evaluate(e=>e.open))!==v,'FAQ open '+i+' '+w);await x.locator('summary').click();assert((await x.evaluate(e=>e.open))===v,'FAQ restore '+i+' '+w);}}
await ctx.close();return {http:res.status(),...result,errors,bad}}
(async()=>{let s0,s1,b;try{s0=await serve(false,8751);s1=await serve(true,8752);b=await chromium.launch({channel:'chrome',headless:true});const summary=[];
for(const w of [1440,390,320]){
const x=await inspect(b,false,8751,w),y=await inspect(b,true,8752,w);
assert(x.http===200&&y.http===200,'HTTP '+w);assert(y.width===y.scrollWidth,'Horizontal '+w);
assert(x.images.length===y.images.length&&y.images.length>=4&&y.images.every(e=>e.loaded),'Images '+w);
assert(x.faq.length===y.faq.length&&y.faq.length===8,'FAQ count '+w);
assert(JSON.stringify(x.links)===JSON.stringify(y.links)&&JSON.stringify(x.line)===JSON.stringify(y.line)&&JSON.stringify(x.tel)===JSON.stringify(y.tel),'CTA '+w);
assert(y.hero.includes('通常分解で十分か')&&y.hero.includes('追加費用'),'FV trust copy '+w);
assert(!y.anchors.length&&!y.overflow.length&&!y.errors.length&&!y.bad.length,'Layout '+w+' '+JSON.stringify({bad:y.bad,overflow:y.overflow,anchors:y.anchors,errors:y.errors}));
summary.push({width:w,http:y.http,images:y.images.length,faq:y.faq.length,line:y.line.length,tel:y.tel.length,errors:y.errors.length,pass:true});}
console.log('YONABARU_PREVIEW_PASS '+JSON.stringify(summary));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(summary,null,2));
}finally{if(b)await b.close();if(s0)await new Promise(r=>s0.close(r));if(s1)await new Promise(r=>s1.close(r))}})().catch(e=>{console.error('YONABARU_PREVIEW_FAIL',e);process.exit(1)});