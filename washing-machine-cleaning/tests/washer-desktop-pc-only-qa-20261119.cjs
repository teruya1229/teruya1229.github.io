'use strict';
/* Read-only before/after: published old layout vs local branch. External tracking is blocked. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=process.cwd();
const out='/tmp/washer-desktop-polish-qa';fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const full=path.resolve(root,'.'+pathname,pathname.endsWith('/')?'index.html':'');
  if(!full.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(full,(e,b)=>{if(e)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream'}).end(b)});
});
const sections=['.hero','#diagnosis','#concerns','#why','#movie','#reviews','#price','#about','#flow','#area','#faq','.related-services','.end-cta'];
const selectors=['.container','.hero__grid','.hero__photo','.hero__prices','.washer-diagnosis__inner','.washer-diagnosis__form',
  '.symptoms__grid','.split-intro','.step-cards','.proof__grid','.reviews__grid','.price-grid',
  '.drum-policy','.price-notes','.about__grid','.flow-grid','.area__grid','.faq-list',
  '.related-services__grid','.end-cta__buttons'];
const report={status:'RUNNING',viewports:[],errors:[],counts:{mobileStable:0,desktopImproved:0}};
const box=e=>{const r=e.getBoundingClientRect();return{x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)}};
async function inspect(browser,variant,width,url){
  const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await ctx.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(['127.0.0.1','teruya1229.github.io'].includes(u.hostname))return route.continue();
    return route.abort('blockedbyclient'); // no GA4/LINE/YouTube external network
  });
  const page=await ctx.newPage(),err=[];
  page.on('pageerror',e=>err.push(e.message));
  try{
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(response.status(),200,variant+' '+width+' HTTP');
    await page.evaluate(async()=>{
      document.querySelectorAll('img').forEach(img=>img.loading='eager');
      await Promise.all([...document.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
      await document.fonts.ready;
    });
    await page.waitForTimeout(250);
    const info=await page.evaluate((sels)=>{
      const box=e=>{const r=e.getBoundingClientRect();return{x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)}};
      const rects=Object.fromEntries(sels.map(s=>[s,document.querySelector(s)?box(document.querySelector(s)):null]));
      const ratios=sels.reduce((o,s)=>{const e=document.querySelector(s);o[s]=e?{grid:getComputedStyle(e).gridTemplateColumns,display:getComputedStyle(e).display}:null;return o},{});
      const reviews=[...document.querySelectorAll('.review-card')].map(box);
      return {
        width:innerWidth,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
        sections:document.querySelectorAll('main section').length,reviews:document.querySelectorAll('.review-card').length,
        questions:document.querySelectorAll('.washer-diagnosis__question').length,photos:[...document.querySelectorAll('.symptom__photo img,.step-card__photo img')].map(i=>i.naturalWidth>0),
        prices:[...document.querySelectorAll('.hero__prices strong')].map(e=>e.textContent.trim()),
        line:document.querySelector('a[data-cta-location="diagnosis_result"]')?.getAttribute('href'),
        ga4:document.head.innerHTML.includes('G-X8LKLFDL3G'),
        rects,ratios,reviewRects:reviews
      };
    },selectors);
    assert.equal(info.sections,13);assert.equal(info.reviews,4);assert.equal(info.questions,3);
    assert.equal(info.line,'https://lin.ee/tsilra6');assert(info.ga4);
    assert.equal(info.photos.length,6);assert(info.photos.every(Boolean));
    assert(info.scrollWidth<=width+1,variant+' overflow '+width+': '+info.scrollWidth);
    assert.equal(err.length,0,variant+' JS '+width+':'+err.join(','));
    if(width===390||width===820||width===1440||width===1920){
      if(width===1440||width===1920)
        await page.screenshot({path:path.join(out,variant+'-'+width+'-full.png'),fullPage:true,animations:'disabled'});
      for(const name of (width>=1200?sections:['.hero','#diagnosis','#price'])){
        const slug=name.replace(/[^a-z0-9]/gi,'-').replace(/^-+/,'');
        await page.locator(name).screenshot({path:path.join(out,variant+'-'+width+'-'+slug+'.png'),animations:'disabled'});
      }
    }
    return info;
  }finally{await ctx.close()}
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true});
    const old='https://teruya1229.github.io/washing-machine-cleaning/?debug=1';
    const next='http://127.0.0.1:'+server.address().port+'/washing-machine-cleaning/?debug=1';
    for(const width of [320,390,820,1024,1180,1280,1440,1920]){
      const before=await inspect(browser,'before',width,old);
      const after=await inspect(browser,'after',width,next);
      assert.deepEqual(before.prices,after.prices,width+' prices changed');
      const sizes={width,oldContainer:before.rects['.container'].w,newContainer:after.rects['.container'].w,
        oldHeroPhoto:before.rects['.hero__photo'].w,newHeroPhoto:after.rects['.hero__photo'].w,
        oldProofWidth:before.rects['.proof__grid'].w,newProofWidth:after.rects['.proof__grid'].w,
        oldFaqHeight:before.rects['.faq-list'].h,newFaqHeight:after.rects['.faq-list'].h,
        beforeScrollHeight:before.scrollHeight,afterScrollHeight:after.scrollHeight,
        reviewsGridBefore:before.ratios['.reviews__grid'].grid,reviewsGridAfter:after.ratios['.reviews__grid'].grid,
        faqGridBefore:before.ratios['.faq-list'].display+' '+before.ratios['.faq-list'].grid,
        faqGridAfter:after.ratios['.faq-list'].display+' '+after.ratios['.faq-list'].grid};
      if(width<1200){
        for(const name of selectors){
          const a=before.rects[name],b=after.rects[name];if(!a||!b)continue;
          for(const field of ['x','y','w','h'])assert(Math.abs(a[field]-b[field])<=1.1,'Mobile/tablet changed '+width+' '+name+'.'+field+': '+a[field]+' vs '+b[field]);
        }
        assert(Math.abs(before.scrollHeight-after.scrollHeight)<=2,width+' mobile page height changed');
        report.counts.mobileStable++;
      }else{
        assert(after.rects['.container'].w>before.rects['.container'].w+30,'Desktop not wider at '+width);
        assert(after.rects['.hero__photo'].w>before.rects['.hero__photo'].w+40,'Hero photo not bigger at '+width);
        assert(after.rects['.proof__grid'].w>before.rects['.proof__grid'].w+100,'Video/copy still constricted '+width);
        assert(after.rects['.faq-list'].h<before.rects['.faq-list'].h*0.78,'FAQ still one long column '+width);
        assert(after.reviewRects.length===4);
        assert(Math.abs(after.reviewRects[1].y-after.reviewRects[2].y)<=1,'testimonials second row not aligned');
        assert(Math.abs(after.reviewRects[2].y-after.reviewRects[3].y)<=1,'testimonials third review orphaned');
        report.counts.desktopImproved++;
      }
      report.viewports.push(sizes);
    }
    report.status='PASS';
  }catch(e){report.status='FAIL';report.errors.push(String(e.stack||e).slice(0,3500));process.exitCode=1}
  finally{
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log('WASHER_DESKTOP_PC_ONLY_QA '+JSON.stringify(report).slice(0,19000));
    if(browser)await browser.close();await new Promise(r=>server.close(r));
  }
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
