/* BC washer 2026-11-18 buying-reasons follow-through visual QA.
 * Local-only browser, no external LINE/GA4/Ads traffic.
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
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
 const uri=new URL(req.url,'http://127.0.0.1');
 const file=path.resolve(root,'.'+decodeURIComponent(uri.pathname),uri.pathname.endsWith('/')?'index.html':'');
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(file,(err,buf)=>{if(err){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(buf)});
});
const report={status:'RUNNING',viewportChecks:[],symptoms:[],sourceIntegrity:{},errors:[]};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [320,360,390,820,1440]) {
   const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
   await ctx.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto('http://127.0.0.1:'+server.address().port+'/washing-machine-cleaning/?debug=1',{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200);
   const cards=page.locator('.review-card blockquote');
   assert.equal(await cards.count(),4);
   const oldQuote='クリーニングだけでなく、設備関係にも詳しく、洗濯機の故障部分についてもご提案いただきました。';
   const fullQuote=await cards.first().innerText();
   assert(fullQuote.includes(oldQuote));
   const excerpt=await page.locator('.washer-diagnosis__voice-link span').innerText();
   assert.equal(excerpt,'「'+oldQuote+'」');
   assert.equal(await page.locator('a.hero__diagnosis-jump').count(),1);
   await page.locator('.hero__diagnosis-jump').click();
   await page.locator('input[name="washer_type"][value="drum"]').check();
   await page.locator('[name="usage_age"]').selectOption('1to4');
   await page.locator('[name="symptom"]').selectOption('drying');
   await page.locator('.washer-diagnosis__submit').click();
   assert(await page.locator('#washer-diagnosis-result').isVisible());
   assert.equal(await page.locator('#washer-diagnosis-proof-link').getAttribute('href'),'#symptom-drying');
   await page.locator('#washer-diagnosis-result').screenshot({path:out+'/evidence-'+width+'.png',animations:'disabled'});
   const line=page.locator('a[data-cta-location="diagnosis_result"]');
   await line.scrollIntoViewIfNeeded();
   await page.waitForTimeout(150);
   const measurement=await page.evaluate(()=>{
      const rect=document.querySelector('a[data-cta-location="diagnosis_result"]').getBoundingClientRect();
      const fixed=document.querySelector('.mobile-bar').getBoundingClientRect();
      const style=getComputedStyle(document.querySelector('.mobile-bar'));
      return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,buttonRect:{top:rect.top,bottom:rect.bottom},fixedRect:{top:fixed.top,bottom:fixed.bottom},stickyVisibility:style.visibility,stickyPointer:style.pointerEvents,stickyDisplay:style.display,hiddenClass:document.documentElement.classList.contains('washer-diagnosis-inline-line-visible')};
   });
   assert(measurement.scrollWidth<=width+1,'Horizontal overflow '+width);
   if(width<=390) {
      assert.equal(measurement.hiddenClass,true,'Result CTA should suppress fixed bar at '+width);
      assert.equal(measurement.stickyVisibility,'hidden','Fixed CTA still visible at '+width);
      assert.equal(measurement.stickyPointer,'none','Fixed CTA intercepts tap at '+width);
   }
   await line.click();
   const events=await page.evaluate(()=>window.dataLayer.filter(x=>x&&x[0]==='event').map(x=>x[1]));
   assert(events.includes('line_click')&&events.includes('cta_click'));
   if(width===390) {
     await page.locator('.washer-diagnosis__voice-link').click();
     assert.equal(await page.evaluate(()=>location.hash),'#reviews');
     await page.locator('#reviews').screenshot({path:out+'/reviews-390.png',animations:'disabled'});
   }
   assert.equal(errors.length,0,'JS errors '+errors.join('; '));
   report.viewportChecks.push({width,measurement,events:events.filter(v=>/diagnosis_|line_click|cta_click/.test(v)),jsErrors:0});
   await ctx.close();
  }
  for(const test of [
    {name:'flakes',type:'top',age:'1to4',expected:'#symptom-flakes'},
    {name:'odor',type:'top',age:'1to4',expected:'#symptom-odor'},
    {name:'drying',type:'drum',age:'1to4',expected:'#symptom-drying'},
    {name:'drying-top',type:'top',age:'1to4',symptom:'drying',expected:'#why'},
    {name:'leak',type:'drum',age:'1to4',expected:'#faq'},
    {name:'new',type:'top',age:'under1',symptom:'odor',expected:'#faq'},
    {name:'error',type:'drum',age:'9plus',expected:'#faq'}
  ]){
    const ctx=await browser.newContext({viewport:{width:390,height:850}});
    await ctx.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
    const page=await ctx.newPage();
    await page.goto('http://127.0.0.1:'+server.address().port+'/washing-machine-cleaning/?debug=1',{waitUntil:'domcontentloaded'});
    await page.locator('input[name="washer_type"][value="'+test.type+'"]').check();
    await page.locator('[name="usage_age"]').selectOption(test.age);
    await page.locator('[name="symptom"]').selectOption(test.symptom||test.name);
    await page.locator('.washer-diagnosis__submit').click();
    const proof=await page.locator('#washer-diagnosis-proof-link').getAttribute('href');
    assert.equal(proof,test.expected,'Wrong evidence '+test.name);
    report.symptoms.push({name:test.name,evidenceTarget:proof,pass:true});
    await ctx.close();
  }
  report.status='PASS';
 }catch(e){report.status='FAIL';report.errors.push(String(e.stack||e));process.exitCode=1}
 finally{
  fs.writeFileSync(out+'/buying-reasons-report.json',JSON.stringify(report,null,2));
  console.log('WASHER_BUYING_REASONS_QA '+JSON.stringify(report).slice(0,18000));
  await browser.close();await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});