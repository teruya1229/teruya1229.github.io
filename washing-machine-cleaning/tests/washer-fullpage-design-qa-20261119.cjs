'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=process.cwd(),out='/tmp/washer-fullpage-design-qa';fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const file=path.resolve(root,'.'+name,name.endsWith('/')?'index.html':'');
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(err,bytes)=>{if(err)return res.writeHead(404).end();
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes);});
});
const sections=['.hero','#diagnosis','#concerns','#why','#movie','#reviews','#price','#about','#flow','#area','#faq','.related-services','.end-cta'];
const report={status:'RUNNING',viewports:[],errors:[]};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'chrome'});
  for(const width of [320,360,390,820,1440]){
    const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await ctx.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
    const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto('http://127.0.0.1:'+server.address().port+'/washing-machine-cleaning/?debug=1',{waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(response.status(),200,'HTTP '+width);
    assert.equal(await page.locator('main section').count(),13,'sections '+width);
    assert.equal(await page.locator('.review-card blockquote').count(),4,'review count '+width);
    assert.equal(await page.locator('.washer-diagnosis__question').count(),3,'questions '+width);
    const photos=await page.evaluate(async()=>{
      const imgs=[...document.querySelectorAll('.symptom__photo img,.step-card__photo img')];
      imgs.forEach(i=>i.loading='eager');
      await Promise.all(imgs.map(i=>i.decode()));
      return imgs.map(i=>({ok:i.naturalWidth>0,w:Math.round(i.getBoundingClientRect().width),h:Math.round(i.getBoundingClientRect().height)}))
    });
    assert.equal(photos.length,6,'photo count '+width);
    assert(photos.every(x=>x.ok),'image load '+width);
    const layout=await page.evaluate(()=>({
      width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,
      priceNotes:document.querySelectorAll('#price .price-notes').length,
      containsBoltWarning:document.querySelector('#price').textContent.includes('背面ボルト式'),
      proofPhotos:document.querySelectorAll('.symptom__photo').length,
      reviewSourceLinks:document.querySelectorAll('.review-card__citation a').length,
      linkCorrect:[...document.querySelectorAll('a[data-cta-location]')].filter(x=>x.href.startsWith('https://lin.ee/')).every(x=>x.href==='https://lin.ee/tsilra6'),
      detailsOpen:document.querySelector('.price-notes').open,
      summaryText:document.querySelector('.price-notes summary').textContent.trim()
    }));
    assert(layout.scrollWidth<=width+1,'horizontal overflow '+width);
    assert.equal(layout.priceNotes,1);
    assert(layout.containsBoltWarning);
    assert.equal(layout.proofPhotos,3);
    assert.equal(layout.reviewSourceLinks,3);
    assert(layout.linkCorrect);
    assert.equal(layout.detailsOpen,false);
    assert.equal(layout.summaryText,'ご予約前に確認したい料金・施工条件');
    await page.locator('.price-notes summary').click();
    assert(await page.locator('.price-notes').evaluate(el=>el.open),'details failed to open '+width);
    assert.equal(await page.locator('.price-notes li').count(),5);
    await page.locator('.price-notes summary').click();
    assert(!(await page.locator('.price-notes').evaluate(el=>el.open)),'details failed to close '+width);
    const source=await page.locator('.review-card__citation a').allTextContents();
    assert(source.every(s=>s.trim()==='口コミの掲載元を確認 ↗'));
    await page.locator('a.hero__diagnosis-jump').click();
    await page.locator('input[name="washer_type"][value="drum"]').check();
    await page.locator('select[name="usage_age"]').selectOption('1to4');
    await page.locator('select[name="symptom"]').selectOption('drying');
    await page.locator('.washer-diagnosis__submit').click();
    assert(await page.locator('#washer-diagnosis-result').isVisible());
    const values=await page.evaluate(()=>['clean','inspect','replace'].map(k=>Number(document.querySelector('#washer-diagnosis-percent-'+k).textContent.replace('%',''))));
    assert.deepEqual(values,[60,35,5]);
    if(width===320||width===390||width===1440){
      const snaps=[['.hero','hero'],['#price','price'],['#area','area'],['#faq','faq'],['.end-cta','final']];
      for(const [selector,name] of snaps)await page.locator(selector).screenshot({path:path.join(out,width+'-'+name+'.png'),animations:'disabled'});
    }
    assert.equal(errors.length,0,'JS '+width+' '+errors.join(';'));
    report.viewports.push({width,...layout,photoCount:photos.length,score:values,jsErrors:errors.length});
    await ctx.close();
  }
  report.status='PASS';
 }catch(e){report.status='FAIL';report.errors.push(String(e.stack||e));process.exitCode=1}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('WASHER_FULLPAGE_DESIGN_QA '+JSON.stringify(report).slice(0,18000));if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});