/* BC washer LP - before/after real Chrome visual and CRO regression.
 * Before uses current GitHub Pages publication; after uses isolated local branch.
 * External analytics, LINE, YouTube requests are blocked, not sent.
 */
'use strict';
const { chromium } = require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=process.cwd();
const out='/tmp/washer-design-quality-qa';
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
 const full=path.resolve(root,'.'+pathname,pathname.endsWith('/')?'index.html':'');
 if(!full.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(full,(err,buf)=>{
  if(err){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream'}).end(buf);
 });
});
const beforeUrl='https://teruya1229.github.io/washing-machine-cleaning/?debug=1';
const widths=[320,360,390,820,1440];
const report={status:'RUNNING',before:[],after:[],comparison:[],errors:[]};
async function checkPage(browser,width,variant,url) {
 const ctx=await browser.newContext({viewport:{width,height:880},reducedMotion:'reduce'});
 await ctx.route('**/*',route=>{
  const u=route.request().url();
  const host=new URL(u).hostname;
  if(host==='127.0.0.1'||(variant==='before'&&host==='teruya1229.github.io'))return route.continue();
  return route.abort('blockedbyclient');
 });
 const page=await ctx.newPage(),jsErrors=[];
 page.on('pageerror',e=>jsErrors.push(e.message));
 try {
  const resp=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(resp.status(),200,variant+' HTTP '+width);
  await page.locator('#washer-diagnosis-form').waitFor({state:'visible'});
  const snapshots=[];
  async function shot(loc,name){
    const target=page.locator(loc);
    await target.screenshot({path:path.join(out,name),animations:'disabled',timeout:25000});
    snapshots.push(name);
  }
  await shot('.hero',variant+'-hero-'+width+'.png');
  await page.locator('.hero__diagnosis-jump').click();
  await page.locator('input[name="washer_type"][value="drum"]').check();
  await page.locator('[name="usage_age"]').selectOption('1to4');
  await page.locator('[name="symptom"]').selectOption('drying');
  await page.locator('.washer-diagnosis__submit').click();
  assert(await page.locator('#washer-diagnosis-result').isVisible());
  await shot('#washer-diagnosis-result',variant+'-result-'+width+'.png');
  if(variant==='after'){
    await shot('#flow',variant+'-flow-'+width+'.png');
    if(width===320||width===390)await shot('#price',variant+'-price-'+width+'.png');
  }
  const info=await page.evaluate(()=>{
   const style=(selector,key)=>{const el=document.querySelector(selector);return el?getComputedStyle(el)[key]:null};
   const box=selector=>{const e=document.querySelector(selector);return e?Math.round(e.getBoundingClientRect().height):null};
   return{
     scrollWidth:document.documentElement.scrollWidth,
     viewport:window.innerWidth,
     sections:document.querySelectorAll('main section').length,
     reviews:document.querySelectorAll('.review-card blockquote').length,
     questions:document.querySelectorAll('.washer-diagnosis__question').length,
     resultHeight:box('#washer-diagnosis-result'),
     heroHeight:box('.hero'),
     detailHeight:box('#flow'),
     evidenceBackground:style('.washer-diagnosis__evidence','backgroundColor'),
     evidenceBorder:style('.washer-diagnosis__evidence','borderTopWidth'),
     flowBackground:style('.flow-grid>div','backgroundColor'),
     relatedShadow:style('.related-service','boxShadow'),
     trustBackground:style('.hero__trust span','backgroundColor'),
     lineURL:document.querySelector('a[data-cta-location="diagnosis_result"]')?.getAttribute('href'),
     price:document.querySelector('.price-card--featured .price-card__price strong')?.textContent.trim(),
     promo:document.querySelector('.hero__prices')?.textContent.trim(),
     ga4:document.documentElement.outerHTML.includes('G-X8LKLFDL3G'),
     disclaimer:document.querySelector('.washer-diagnosis__disclaimer')?.textContent.trim(),
     h1:document.querySelector('h1')?.textContent.trim(),
     source:document.querySelector('.washer-diagnosis__voice-link span')?.textContent.trim(),
     eventNames:(window.dataLayer||[]).filter(x=>x?.[0]==='event').map(x=>x[1])
   };
  });
  assert(info.scrollWidth<=width+1,variant+' horizontal overflow '+width+':'+info.scrollWidth);
  assert.equal(info.sections,13);
  assert.equal(info.reviews,4);
  assert.equal(info.questions,3);
  assert.equal(info.lineURL,'https://lin.ee/tsilra6');
  assert.equal(info.price,'25,000');
  assert(info.ga4);
  assert.deepEqual(jsErrors,[],variant+' js errors');
  if(variant==='after') {
    assert(info.disclaimer.includes('統計実績ではありません'));
    assert(info.disclaimer.includes('修理や買い替えを確定するものではありません'));
    assert(info.evidenceBackground==='rgba(0, 0, 0, 0)', 'nested evidence background not removed');
    if(width<=390){
      for(const item of [
        ['.hero .btn--wide','hero'],
        ['a[data-cta-location="price-drum"]','price'],
        ['a[data-cta-location="diagnosis_result"]','result']
      ]){
        await page.locator(item[0]).scrollIntoViewIfNeeded();
        await page.waitForTimeout(280);
        const sticky=await page.locator('.mobile-bar').evaluate(el=>({
          visibility:getComputedStyle(el).visibility,
          pointer:getComputedStyle(el).pointerEvents
        }));
        assert.equal(sticky.visibility,'hidden',width+' '+item[1]+' sticky bar overlaps');
        assert.equal(sticky.pointer,'none',width+' '+item[1]+' sticky bar captures taps');
      }
      await page.locator('#faq .sec-head h2').scrollIntoViewIfNeeded();
      await page.waitForTimeout(280);
      const sticky=await page.locator('.mobile-bar').evaluate(el=>getComputedStyle(el).visibility);
      assert.equal(sticky,'visible',width+' fixed CTA should return while reading FAQ');
    }
    await page.locator('a[data-cta-location="diagnosis_result"]').click();
    const events=await page.evaluate(()=>(window.dataLayer||[]).filter(x=>x?.[0]==='event').map(x=>x[1]));
    assert(events.includes('line_click')&&events.includes('cta_click'));
    assert.equal(await page.locator('.washer-diagnosis__section-links a').count(),2);
    assert.equal(await page.locator('.washer-diagnosis__evidence-link').count(),1);
    assert.equal(await page.locator('.washer-diagnosis__voice-link').count(),1);
  }
  return {...info,width,variant,screenshots:snapshots,jsErrors:jsErrors.length};
 } finally {await ctx.close();}
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const afterUrl='http://127.0.0.1:'+server.address().port+'/washing-machine-cleaning/?debug=1';
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  for(const width of widths){
    const before=await checkPage(browser,width,'before',beforeUrl);
    const after=await checkPage(browser,width,'after',afterUrl);
    assert.equal(before.h1,after.h1,'hero title changed '+width);
    assert.equal(before.promo,after.promo,'campaign prices changed '+width);
    assert.equal(before.source,after.source,'review excerpt changed '+width);
    report.before.push(before);report.after.push(after);
    report.comparison.push({width,heroBefore:before.heroHeight,heroAfter:after.heroHeight,resultBefore:before.resultHeight,resultAfter:after.resultHeight,flowBefore:before.detailHeight,flowAfter:after.detailHeight});
  }
  report.status='PASS';
 }catch(e){report.status='FAIL';report.errors.push(String(e.stack||e).slice(0,3500));process.exitCode=1;}
 finally{
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('WASHER_DESIGN_QUALITY_QA '+JSON.stringify({status:report.status,comparison:report.comparison,errors:report.errors}).slice(0,12500));
  if(browser)await browser.close().catch(()=>{});
  await new Promise(r=>server.close(r));
 }
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
