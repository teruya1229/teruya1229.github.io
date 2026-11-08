/* Browser-based QA for washer diagnosis. No external analytics event is sent.
 * Launches an isolated Chrome profile and serves only the checked-out repository over localhost.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = process.cwd();
const output = path.resolve(process.env.RUNNER_TEMP || process.env.TMPDIR || process.cwd(), 'washer-diagnosis-qa');
fs.mkdirSync(output,{recursive:true});
const mime = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
function fail(message){throw new Error(message)}
function expect(condition,message){if(!condition)fail(message)}
const server=http.createServer((req,res)=>{
  let url;
  try{url=new URL(req.url,'http://127.0.0.1')}catch(_){res.writeHead(400).end();return}
  const pathname=decodeURIComponent(url.pathname);
  const full=path.resolve(root,'.'+pathname,(pathname.endsWith('/')?'index.html':''));
  if(!full.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(full,(err,contents)=>{
    if(err){res.writeHead(404).end();return}
    res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'}).end(contents)
  })
});
function events(page) {
  return page.evaluate(()=>(window.dataLayer||[]).filter(e=>e&&e[0]==='event').map(e=>({name:e[1],props:e[2]||{}})))
}
async function run() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/washing-machine-cleaning/?utm_source=instagram&utm_medium=paid_social&debug=1';
  let browser;
  const report={browser:'',sizes:[],scenarios:0,events:[],exceptions:[],screenshots:[],status:'running'};
  try{
    try{browser=await chromium.launch({channel:'chrome',headless:true}) ; report.browser='system Google Chrome'}
    catch(e){report.chrome_error=String(e.message).slice(0,250);browser=await chromium.launch({headless:true});report.browser='Playwright Chromium'}
    for(const width of [1440,820,390,360,320]){
      const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
      await ctx.route('**/*', route=>{const target=route.request().url();return target.startsWith('http://127.0.0.1:')?route.continue():route.abort();});
      const page=await ctx.newPage();
      const pageErrors=[];
      page.on('pageerror',e=>pageErrors.push(e.message));
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      expect(response&&response.status()===200,'HTTP not 200: '+width);
      await page.locator('#washer-diagnosis-form').waitFor({state:'visible'});
      const loaded=await page.evaluate(()=>({
        css:[...document.styleSheets].some(s=>(s.href||'').includes('diagnosis.css')),
        js:!!document.querySelector('script[src*="diagnosis.js"]'),
        order:document.querySelector('.hero').compareDocumentPosition(document.querySelector('#diagnosis')) & Node.DOCUMENT_POSITION_FOLLOWING,
        width:document.documentElement.scrollWidth,
        viewport:window.innerWidth
      }));
      expect(loaded.css && loaded.js && loaded.order,'asset/order failure '+width);
      expect(loaded.width <= loaded.viewport+1,'Horizontal overflow '+width+': '+loaded.width+' > '+loaded.viewport);
      expect(pageErrors.length===0,'JS page errors '+width+' '+pageErrors.join('; '));
      const out=path.join(output,'diagnosis-'+width+'.png');
      await page.locator('#diagnosis').screenshot({path:out,animations:'disabled'});
      report.screenshots.push(path.basename(out));
      await page.locator('input[name="washer_type"][value="drum"]').check();
      await page.locator('[name="usage_age"]').selectOption('1to4');
      await page.locator('[name="symptom"]').selectOption('drying');
      await page.locator('.washer-diagnosis__submit').click();
      expect(await page.locator('#washer-diagnosis-result').isVisible(),'Result hidden '+width);
      const score=await page.evaluate(()=>['clean','inspect','replace'].map(k=>Number(document.querySelector('#washer-diagnosis-percent-'+k).textContent.replace('%',''))));
      expect(score.reduce((a,b)=>a+b,0)===100,'Total not 100 '+width);
      const names=(await events(page)).map(e=>e.name);
      for(const n of ['diagnosis_start','diagnosis_submit','diagnosis_result_view'])expect(names.includes(n),'Missing '+n+' '+width);
      if(width===390){
        for(const machine of ['top','drum']){
          await page.locator('input[name="washer_type"][value="'+machine+'"]').check();
          for(const age of ['under1','1to4','5to6','7to8','9plus']){
            await page.locator('[name="usage_age"]').selectOption(age);
            for(const symptom of ['flakes','odor','drying','maintenance','error','spin','vibration','leak']){
              await page.locator('[name="symptom"]').selectOption(symptom);
              await page.locator('.washer-diagnosis__submit').click();
              const vals=await page.evaluate(()=>['clean','inspect','replace'].map(k=>Number(document.querySelector('#washer-diagnosis-percent-'+k).textContent.replace('%',''))));
              expect(vals.reduce((a,b)=>a+b,0)===100,'80-case sum failure: '+machine+' '+age+' '+symptom);
              expect(!['error','spin','vibration','leak'].includes(symptom)||vals[0]===0,'Unsafe recommendation: '+machine+' '+age+' '+symptom);
              report.scenarios++;
            }
          }
        }
        await page.locator('#concerns').scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
        const lpe=await events(page);
        expect(lpe.filter(e=>e.name==='diagnosis_lp_view').length===1,'LP view should fire exactly once after result');
        const line=page.locator('a[data-cta-location="diagnosis_result"]');
        expect((await line.getAttribute('href'))==='https://lin.ee/tsilra6','LINE destination changed');
        await line.click();
        const lineEvents=await events(page);
        expect(lineEvents.filter(e=>e.name==='line_click'&&e.props.cta_location==='diagnosis_result').length===1,'Missing LINE click event');
        expect(lineEvents.filter(e=>e.name==='cta_click'&&e.props.cta_location==='diagnosis_result').length===1,'Missing CTA click event');
        report.events=['diagnosis_start','diagnosis_submit','diagnosis_result_view','diagnosis_lp_view','line_click','cta_click'];
        await page.locator('#washer-diagnosis-result').screenshot({path:path.join(output,'diagnosis-result-390.png'),animations:'disabled'});
        report.screenshots.push('diagnosis-result-390.png');
      }
      expect(pageErrors.length===0,'JS page error after actions '+width+': '+pageErrors.join('; '));
      report.sizes.push({width,scrollWidth:loaded.width,score,jsErrors:pageErrors.length,pass:true});
      await ctx.close();
    }
    report.status='PASS';
  }catch(e){report.status='FAIL';report.error=String(e.stack||e).slice(0,2000);process.exitCode=1}
  finally{
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    console.log('WASHER_BROWSER_QA '+JSON.stringify({...report,screenshots:report.screenshots.length}));
    if(browser)await browser.close().catch(()=>{});
    await new Promise(resolve=>server.close(resolve))
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;server.close()});
