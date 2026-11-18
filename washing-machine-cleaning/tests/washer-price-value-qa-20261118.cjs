'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('playwright');
const root=process.cwd(),dir='/tmp/washer-price-value-qa';fs.mkdirSync(dir,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{let url=new URL(req.url,'http://127.0.0.1');const name=path.resolve(root,'.'+decodeURIComponent(url.pathname),url.pathname.endsWith('/')?'index.html':'');if(!name.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(name,(err,buf)=>{if(err)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(name)]||'application/octet-stream'}).end(buf)});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});const report={status:'RUNNING',viewports:[],errors:[]};
 try{
  for(const width of [320,360,390,820,1440]){
   const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await ctx.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
   const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
   const response=await page.goto('http://127.0.0.1:'+server.address().port+'/washing-machine-cleaning/?debug=1',{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
   const price=page.locator('.price-card--featured');
   assert.equal(await price.locator('.price-card__value').count(),1);
   assert.equal(await price.locator('.price-card__value li').count(),3);
   assert((await price.innerText()).includes('25,000'));
   assert((await price.innerText()).includes('＋8,000'));
   assert((await price.innerText()).includes('背面ボルト式'));
   assert.equal(await price.locator('.price-card__value a').getAttribute('href'),'#why');
   await price.locator('.price-card__value a').click();
   assert.equal(await page.evaluate(()=>location.hash),'#why');
   await price.scrollIntoViewIfNeeded();
   await price.screenshot({path:dir+'/price-'+width+'.png',animations:'disabled'});
   const state=await page.evaluate(()=>({viewport:innerWidth,page:document.documentElement.scrollWidth,questions:document.querySelectorAll('.washer-diagnosis__question').length,price:document.querySelector('.price-card--featured .price-card__price strong')?.textContent.trim(),line:document.querySelector('a[data-cta-location="price-drum"]')?.href,tracking:document.documentElement.outerHTML.includes('G-X8LKLFDL3G'),unreadable:[...document.querySelectorAll('.price-card--featured,.price-card__value')].some(e=>e.getBoundingClientRect().width<50)}));
   assert(state.page<=width+1,'overflow '+width);assert.equal(state.questions,3);assert.equal(state.price,'25,000');assert.equal(state.line,'https://lin.ee/tsilra6');assert(state.tracking&&!state.unreadable);assert.equal(errs.length,0);
   report.viewports.push({width,...state,jsErrors:errs.length});await ctx.close();
  }
  report.status='PASS';
 }catch(e){report.status='FAIL';report.errors.push(String(e.stack||e));process.exitCode=1}
 finally{fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log('WASHER_PRICE_VALUE_QA '+JSON.stringify(report));await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});