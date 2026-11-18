/* BC washer 2026-11-18 pre-publish CRO QA.
 * No outbound analytics, LINE, or Ads traffic. This is an isolated local server.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=process.cwd();
const out='/tmp/washer-early-cro-qa';
fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  const file=path.resolve(root,'.'+decodeURIComponent(u.pathname),u.pathname.endsWith('/')?'index.html':'');
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(err,b)=>{if(err){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(b)});
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const url='http://127.0.0.1:'+server.address().port+'/washing-machine-cleaning/?debug=1';
 const browser=await chromium.launch({headless:true});
 const report={status:'STARTED',details:[]};
 try{
  for(const width of [320,360,390,820,1440]){
   const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
   await ctx.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
   const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(res.status(),200);
   const selector='.hero__diagnosis-jump';
   assert.equal(await page.locator(selector).count(),1);
   assert.equal(await page.locator(selector).getAttribute('href'),'#diagnosis');
   assert.equal(await page.locator(selector).isVisible(),true);
   assert.equal(await page.locator('#diagnosis').count(),1);
   assert.equal(await page.locator('.hero').evaluate(e=>e.compareDocumentPosition(document.querySelector('#diagnosis'))&Node.DOCUMENT_POSITION_FOLLOWING),4);
   assert.equal(await page.locator('.washer-diagnosis__question').count(),3);
   await page.locator(selector).screenshot({path:out+'/jump-'+width+'.png'});
   await page.locator(selector).click();
   assert.equal(await page.evaluate(()=>location.hash),'#diagnosis');
   const top=await page.locator('#diagnosis').evaluate(e=>e.getBoundingClientRect().top);
   assert(top>=-10 && top<130,'Jump not near viewport top: '+top);
   await page.locator('input[name="washer_type"][value="top"]').check();
   await page.locator('select[name="usage_age"]').selectOption('1to4');
   await page.locator('select[name="symptom"]').selectOption('flakes');
   await page.locator('.washer-diagnosis__submit').click();
   assert.equal(await page.locator('#washer-diagnosis-result').isVisible(),true);
   const resultLabel=await page.locator('a[data-cta-location="diagnosis_result"]').innerText();
   assert(resultLabel.includes('診断結果をLINEで無料相談'));
   const review=page.locator('.washer-diagnosis__section-links a[href="#reviews"]');
   assert.equal(await review.count(),1);
   assert.equal(await review.isVisible(),true);
   await page.locator('#washer-diagnosis-result').screenshot({path:out+'/result-'+width+'.png'});
   const dims=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth:innerWidth}));
   assert(dims.scrollWidth<=dims.innerWidth+1,'Horizontal overflow at '+width+': '+JSON.stringify(dims));
   assert.equal(errors.length,0,'JavaScript errors at '+width+errors.join(';'));
   report.details.push({width,pass:true,jumpHash:true,threeQuestions:true,reviewLink:true,noOverflow:true,noJsErrors:true});
   await ctx.close();
  }
  report.status='PASS';
 }catch(e){report.status='FAIL';report.error=String(e.stack||e).slice(0,2500);process.exitCode=1}
 finally{
  fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
  console.log('WASHER_EARLY_CRO_QA '+JSON.stringify(report));
  await browser.close();await new Promise(ok=>server.close(ok));
 }
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
