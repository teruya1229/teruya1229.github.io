'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),{chromium}=require('playwright');
const root=process.cwd(),out=path.resolve(process.env.RUNNER_TEMP||process.cwd(),'washer-flow-icons-qa');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const filepath=path.resolve(root,'.'+pathname,pathname.endsWith('/')?'index.html':'');if(!filepath.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(filepath,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(filepath)]||'application/octet-stream'}).end(data);});});
const report={status:'RUNNING',widths:[],errors:[]};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
browser=await chromium.launch({headless:true});
for(const width of [1440,820,390,320]){
 const ctx=await browser.newContext({viewport:{width,height:880},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];
 await ctx.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
 page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto('http://127.0.0.1:'+server.address().port+'/washing-machine-cleaning/',{waitUntil:'domcontentloaded'});
 if(response.status()!==200)throw Error('HTTP '+response.status());
 const state=await page.evaluate(async()=>{
  const els=[...document.querySelectorAll('#flow .flow-card__icon')];
  els.forEach(el=>el.loading='eager');
  await Promise.race([Promise.all(els.map(el=>el.decode())),new Promise((_,reject)=>setTimeout(()=>reject(Error('decode timeout')),10000))]);
  const cards=[...document.querySelectorAll('#flow .flow-card')];
  return {pageWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,imgs:els.map(el=>({src:el.getAttribute('src'),loaded:el.naturalWidth>0,naturalHeight:el.naturalHeight,rect:{width:Math.round(el.getBoundingClientRect().width),height:Math.round(el.getBoundingClientRect().height)}})),cards:cards.map(card=>({title:card.querySelector('strong')?.textContent,number:card.querySelector('.flow-card__header span')?.textContent,rect:{width:Math.round(card.getBoundingClientRect().width),height:Math.round(card.getBoundingClientRect().height)}})),hasDiagnosis:!!document.getElementById('washer-diagnosis-form'),lineLink:document.querySelector('a[data-cta-location="flow"]')?.getAttribute('href'),ga4:document.documentElement.outerHTML.includes('G-X8LKLFDL3G')};
 });
 if(state.imgs.length!==3||state.cards.length!==3)throw Error('not 3 cards/icons');
 const expected=['flow-step-01-send-photo.webp','flow-step-02-quote.webp','flow-step-03-clean.webp'];
 if(!state.imgs.every((x,i)=>x.loaded&&x.src.endsWith(expected[i])))throw Error('missing or mismatched icon '+JSON.stringify(state.imgs));
 if(new Set(state.imgs.map(x=>x.rect.width+'x'+x.rect.height)).size!==1)throw Error('icon dimensions unequal');
 if(state.pageWidth>width+1)throw Error('horizontal overflow '+width+':'+state.pageWidth);
 if(!state.hasDiagnosis||!state.ga4||state.lineLink!=='https://lin.ee/tsilra6')throw Error('protected content missing');
 if(errors.length)throw Error('JS '+JSON.stringify(errors));
 await page.locator('#flow').screenshot({path:path.join(out,'flow-'+width+'.png'),animations:'disabled'});
 report.widths.push({width,...state,screenshot:'flow-'+width+'.png',jsErrors:errors.length});
 await ctx.close();
}
report.status='PASS';
}catch(e){report.status='FAIL';report.errors.push(String(e.stack||e));process.exitCode=1}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('WASHER_FLOW_ICONS_QA '+JSON.stringify(report).slice(0,20000));if(browser)await browser.close();await new Promise(r=>server.close(r));}
})();