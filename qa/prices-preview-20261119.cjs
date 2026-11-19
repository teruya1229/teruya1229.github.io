const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),{chromium}=require('playwright');
const root=process.cwd(),dst='prices/',out=path.resolve('qa-prices');fs.mkdirSync(out,{recursive:true});
const current={index:fs.readFileSync(dst+'index.html','utf8'),css:fs.readFileSync(dst+'assets/prices.css','utf8')};
const previous={index:cp.execFileSync('git',['show','origin/main:prices/index.html'],{encoding:'utf8'}),css:cp.execFileSync('git',['show','origin/main:prices/assets/prices.css'],{encoding:'utf8'})};
const assert=(v,msg)=>{if(!v)throw Error(msg)};
function links(v){return [...v.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1])}
function amounts(v){return [...v.matchAll(/[\d,]+円(?:〜|～)?/g)].map(m=>m[0])}
function scripts(v){return [...v.matchAll(/<script\b[\s\S]*?<\/script>/g)].map(m=>m[0])}
for(const key of ['link','amount','script']){let a=key==='link'?links: key==='amount'?amounts:scripts;assert(JSON.stringify(a(previous.index))===JSON.stringify(a(current.index)),key+' changed')}
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
function server(stage,port){return new Promise((resolve,reject)=>{
const instance=http.createServer((req,res)=>{
const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
if(pathname==='/prices/'||pathname==='/prices/index.html'){res.writeHead(200,{'Content-Type':types['.html']});return res.end(stage?current.index:previous.index)}
if(pathname==='/prices/assets/prices.css'){res.writeHead(200,{'Content-Type':types['.css']});return res.end(stage?current.css:previous.css)}
const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end()};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data)})
});instance.listen(port,'127.0.0.1',()=>resolve(instance)).on('error',reject);})}
async function inspect(browser,old,port,width){
const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',deviceScaleFactor:1});
const page=await ctx.newPage(),errors=[],bad=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:'+port)&&r.status()>=400)bad.push(r.status()+' '+r.url())});
await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:'+port+'/')?r.continue():r.abort('blockedbyclient'));
const resp=await page.goto('http://127.0.0.1:'+port+'/prices/',{waitUntil:'domcontentloaded',timeout:45000});
await page.locator('img').evaluateAll(els=>els.forEach(e=>e.loading='eager'));
await page.evaluate(async()=>{await Promise.all([...document.images].map(e=>e.decode().catch(()=>{})))});
const home=await page.evaluate(()=>({cards:[...document.querySelectorAll('#panel-home .price-card')].map(e=>e.innerText.trim()),selected:document.querySelector('#tab-home').getAttribute('aria-selected')}));
await page.screenshot({path:path.join(out,(old?'old':'new')+'-home-'+width+'.png'),fullPage:true,animations:'disabled',timeout:60000});
await page.locator('#tab-business').click();
const biz=await page.evaluate(()=>({cards:[...document.querySelectorAll('#panel-business .price-card')].map(e=>e.innerText.trim()),selected:document.querySelector('#tab-business').getAttribute('aria-selected'),homeHidden:document.querySelector('#panel-home').hidden,businessVisible:!document.querySelector('#panel-business').hidden}));
await page.screenshot({path:path.join(out,(old?'old':'new')+'-business-'+width+'.png'),fullPage:true,animations:'disabled',timeout:60000});
await page.locator('#tab-business').focus();await page.keyboard.press('ArrowLeft');
const keyboard=await page.locator('#tab-home').getAttribute('aria-selected');
const state=await page.evaluate(()=>{
const ids=new Set([...document.querySelectorAll('[id]')].map(e=>e.id));
return {scrollWidth:document.documentElement.scrollWidth,width:innerWidth,
heroBackground:getComputedStyle(document.querySelector('.hero')).backgroundImage,
decorDisplay:getComputedStyle(document.querySelector('.hero'),'::after').display,
serviceSymbol:getComputedStyle(document.querySelector('.service-symbol')).display,
images:[...document.images].map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})),
hrefs:[...document.querySelectorAll('a[href]')].map(i=>i.getAttribute('href')),
missingAnchors:[...document.querySelectorAll('a[href^="#"]')].map(e=>e.getAttribute('href').slice(1)).filter(i=>i&&!ids.has(i)),
outOfBounds:[...document.querySelectorAll('h1,h2,h3,h4,p,a,button')].filter(e=>e.getClientRects().length).map(e=>({t:e.textContent.slice(0,28),r:e.getBoundingClientRect()})).filter(e=>e.r.width>0&&(e.r.left < -4||e.r.right>innerWidth+4)).slice(0,10)};
});
await ctx.close();return {http:resp.status(),...state,home,biz,keyboard,errors,bad};
}
(async()=>{
let b,s0,s1;try{
s0=await server(false,8766);s1=await server(true,8765);b=await chromium.launch({channel:'chrome',headless:true});
const results=[];
for(const width of [1440,390,320]){
const before=await inspect(b,true,8766,width),after=await inspect(b,false,8765,width);
assert(before.http===200&&after.http===200,'HTTP '+width);
assert(JSON.stringify(before.home.cards)===JSON.stringify(after.home.cards),'Household prices changed '+width);
assert(JSON.stringify(before.biz.cards)===JSON.stringify(after.biz.cards),'Business info changed '+width);
assert(before.home.cards.length===8&&before.biz.cards.length===4,'Card count '+width);
assert(after.home.selected==='true'&&after.biz.selected==='true'&&after.biz.homeHidden&&after.biz.businessVisible&&after.keyboard==='true','Tab/keyboard interaction '+width);
assert(after.scrollWidth===width,'Horizontal overflow '+width);
assert(after.images.length===1&&after.images[0].loaded,'Image not loaded '+width);
assert(JSON.stringify(before.hrefs)===JSON.stringify(after.hrefs),'CTA link changed '+width);
assert(after.heroBackground==='none'&&after.decorDisplay==='none'&&after.serviceSymbol==='none','Decoration still active '+width);
assert(!after.missingAnchors.length&&!after.outOfBounds.length&&!after.errors.length&&!after.bad.length,'Layout/js/assets '+width);
results.push({width,http:after.http,homeCards:after.home.cards.length,businessCards:after.biz.cards.length,images:after.images.length,links:after.hrefs.length,jsErrors:after.errors.length,bad:after.bad.length,pass:true});
}
console.log('PRICES_PREVIEW_PASS '+JSON.stringify(results));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));
}finally{if(b)await b.close();if(s0)await new Promise(r=>s0.close(r));if(s1)await new Promise(r=>s1.close(r))}})().catch(e=>{console.error('PRICES_PREVIEW_FAIL',e);process.exit(1)});
