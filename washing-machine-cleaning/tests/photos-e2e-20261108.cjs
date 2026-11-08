'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),{chromium}=require('playwright');
const root=process.cwd();
const report={status:'RUNNING',sizes:[],images:[],errors:[]};
const out=path.resolve(process.env.RUNNER_TEMP||process.cwd(),'washer-photo-qa');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const full=path.resolve(root,'.'+pathname,pathname.endsWith('/')?'index.html':'');
  if(!full.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(full,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream'}).end(data);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  for(const width of [1440,820,390,320]){
    const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await ctx.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
    const page=await ctx.newPage(),err=[];
    page.on('pageerror',e=>err.push(e.message));
    const response=await page.goto('http://127.0.0.1:'+server.address().port+'/washing-machine-cleaning/',{waitUntil:'domcontentloaded'});
    if(!response||response.status()!==200)throw new Error('HTTP fail '+width);
    for(const sel of ['.symptom__photo img','.step-card__photo img'])await page.locator(sel).first().waitFor();
    const data=await page.evaluate(async()=>{
      const a=[...document.querySelectorAll('.symptom__photo img,.step-card__photo img')];
      await Promise.all(a.map(el=>el.decode()));
      return {width:innerWidth,docWidth:document.documentElement.scrollWidth,images:a.map(x=>({src:x.getAttribute('src'),natural:x.naturalWidth+'x'+x.naturalHeight,width:Math.round(x.getBoundingClientRect().width),height:Math.round(x.getBoundingClientRect().height),complete:x.complete,parent:x.parentElement.className,card:x.closest('.symptom')?'symptom':'step'})),typos:document.body.textContent.includes('総脱着'),diagnosis:!!document.getElementById('washer-diagnosis-form'),line:document.querySelector('a[data-cta-location="diagnosis_result"]')?.href};
    });
    if(data.images.length!==6||data.images.some(x=>!x.complete||x.natural.startsWith('0x')))throw new Error('Image not loaded '+width+': '+JSON.stringify(data.images));
    if(data.typos)throw new Error('Old wording found '+width);
    if(!data.diagnosis||!data.line?.includes('lin.ee/tsilra6'))throw new Error('Protected section lost');
    if(data.docWidth>width+1)throw new Error('Horizontal overflow '+width+': '+data.docWidth);
    for(const kind of ['symptom','step']){const imgs=data.images.filter(x=>x.card===kind);if(new Set(imgs.map(x=>x.height)).size!==1||new Set(imgs.map(x=>x.width)).size!==1)throw new Error('Uneven '+kind+' images '+width+': '+JSON.stringify(imgs))}
    if(err.length)throw new Error('JS errors '+err.join(','));
    const output=path.join(out,'lp-'+width+'.png');
    await page.screenshot({path:output,fullPage:true,animations:'disabled'});
    report.sizes.push({width,docWidth:data.docWidth,images:data.images.map(x=>({src:x.src,width:x.width,height:x.height})),screenshot:path.basename(output),errors:err.length});
    await ctx.close();
  }
  report.status='PASS';
 }catch(e){report.status='FAIL';report.errors.push(String(e.stack||e).slice(0,3000));process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('WASHER_PHOTO_QA '+JSON.stringify(report).slice(0,18000));if(browser)await browser.close();await new Promise(r=>server.close(r))}
})();