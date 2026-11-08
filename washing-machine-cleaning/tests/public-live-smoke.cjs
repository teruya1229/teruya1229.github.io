/* Public production URL browser smoke. No LP code or settings are modified. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const TARGET = 'https://teruya1229.github.io/washing-machine-cleaning/?utm_source=instagram&utm_medium=paid_social&debug=1';
const OUT = path.join(process.env.RUNNER_TEMP || process.cwd(), 'washer-public-smoke');
fs.mkdirSync(OUT, { recursive: true });
const report = {
  url: TARGET,
  testType: 'GitHub-hosted isolated browser against PUBLIC production URL',
  caveat: 'WebKit emulation is not physical iPhone Safari. GA4 HTTP request is not proof of GA4 server processing.',
  chrome: [], webkit: [], tracking: {}, errors: [], status: 'RUNNING'
};
function check(ok,msg){if(!ok) throw new Error(msg)}
async function useEngine(engine, label, widths) {
  const browser = await engine.launch({ headless: true });
  try {
    for(const width of widths) {
      const ctx = await browser.newContext({
        viewport: {width, height: 880},
        reducedMotion: 'reduce',
        userAgent: label==='webkit' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined
      });
      const page = await ctx.newPage();
      const errors = [];
      const ga4 = [];
      const received = [];
      const googleNetwork = [];
      page.on('pageerror',e=>errors.push(String(e.message)));
      page.on('request',req=>{
        if(/(googletagmanager|google-analytics)\.com/.test(req.url())) {
          const entry={kind:'request',host:new URL(req.url()).hostname,path:new URL(req.url()).pathname,method:req.method()};
          googleNetwork.push(entry);
          if(/google-analytics\.com\/g\/collect/.test(req.url())) ga4.push(entry);
        }
      });
      page.on('response',response=>{
        if(/(googletagmanager|google-analytics)\.com/.test(response.url())) {
          googleNetwork.push({kind:'response',host:new URL(response.url()).hostname,path:new URL(response.url()).pathname,status:response.status()});
          if(/google-analytics\.com\/g\/collect/.test(response.url())) received.push(response.status());
        }
      });
      page.on('requestfailed',req=>{
        if(/(googletagmanager|google-analytics)\.com/.test(req.url())) {
          googleNetwork.push({kind:'failed',host:new URL(req.url()).hostname,path:new URL(req.url()).pathname,error:req.failure()?.errorText||'unknown'});
        }
      });
      // Videos are not part of diagnosis; do not modify the analytics requests.
      await page.route(/youtube(-nocookie)?\.com/,route=>route.abort());
      const main=await page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:45000});
      check(!!main && main.status()===200,label+' '+width+': LP HTTP status '+(main&&main.status()));
      await page.locator('#washer-diagnosis-form').waitFor({state:'visible',timeout:20000});
      const photoState=await page.evaluate(async()=>{
        const elements=[...document.querySelectorAll('.symptom__photo img,.step-card__photo img')];
        elements.forEach(img=>{img.loading='eager';});
        await Promise.race([
          Promise.all(elements.map(img=>img.decode())),
          new Promise((_,reject)=>setTimeout(()=>reject(new Error('public photo loading timeout')),15000))
        ]);
        return {
          sources:elements.map(img=>img.getAttribute('src')),
          sizes:elements.map(img=>({width:Math.round(img.getBoundingClientRect().width),height:Math.round(img.getBoundingClientRect().height),natural:img.naturalWidth})),
          typo:document.body.textContent.includes('総脱着'),
          page:document.documentElement.scrollWidth
        };
      });
      check(photoState.sources.length===6,label+' '+width+': expected 6 new photos');
      check(!photoState.typo,label+' '+width+': old typo still visible');
      check(photoState.sizes.every(img=>img.natural>0),label+' '+width+': missing photo');
      for(const i of [0,3]) {
        check(new Set(photoState.sizes.slice(i,i+3).map(x=>x.width+'x'+x.height)).size===1,label+' '+width+': inconsistent photo dimensions');
      }
      if(label==='chrome'&&width===390)report.photoUrls=photoState.sources;

      const info=await page.evaluate(()=>({
        scrollWidth:document.documentElement.scrollWidth,
        innerWidth:window.innerWidth,
        formCount:document.querySelectorAll('#washer-diagnosis-form').length,
        js:!!document.querySelector('script[src*="diagnosis.js"]'),
        css:!![...document.styleSheets].find(s=>(s.href||'').includes('diagnosis.css')),
        measurement:(document.documentElement.outerHTML.match(/G-X8LKLFDL3G/g)||[]).length,
        existingLine:document.querySelector('a[data-cta-location="diagnosis_result"]')?.getAttribute('href')
      }));
      check(info.formCount===1 && info.js && info.css && info.measurement>0,label+' '+width+': diagnosis asset missing');
      check(info.scrollWidth<=info.innerWidth+1,label+' '+width+': horizontal overflow '+info.scrollWidth);
      check(info.existingLine==='https://lin.ee/tsilra6',label+' '+width+': LINE href changed');
      await page.locator('input[name="washer_type"][value="drum"]').check();
      await page.locator('select[name="usage_age"]').selectOption('1to4');
      await page.locator('select[name="symptom"]').selectOption('drying');
      await page.locator('.washer-diagnosis__submit').click();
      check(await page.locator('#washer-diagnosis-result').isVisible(),label+' '+width+': result not visible');
      const values=await page.evaluate(()=>['clean','inspect','replace'].map(k=>Number(document.getElementById('washer-diagnosis-percent-'+k).textContent.replace('%',''))));
      check(values.join(',')==='60,35,5',label+' '+width+': unexpected score '+values.join(','));
      const shot=label+'-'+width+'.png';
      await page.locator('#washer-diagnosis-result').screenshot({path:path.join(OUT,shot)});
      if(label==='chrome' && width===390) {
        await page.locator('#concerns').scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
        await page.locator('a[data-cta-location="diagnosis_result"]').click();
        await page.waitForTimeout(2000);
        const events=await page.evaluate(()=>window.dataLayer.filter(x=>x&&x[0]==='event').map(x=>x[1]));
        for(const name of ['diagnosis_start','diagnosis_submit','diagnosis_result_view','diagnosis_lp_view','cta_click','line_click']) {
          check(events.includes(name),'missing '+name+' on public page');
        }
        report.tracking={
          dataLayerEvents:events,
          GA4HttpRequests:ga4.length,
          GA4HttpResponseCodes:received,
          googleNetworkTrace:googleNetwork,
          GA4Id: 'G-X8LKLFDL3G',
          caveat:'HTTP request/response is transport-level observation, not an Analytics property ingestion proof'
        };
      }
      check(errors.length===0,label+' '+width+': JS errors '+JSON.stringify(errors));
      report[label].push({width, httpStatus:main.status(), scrollWidth:info.scrollWidth, score:values, jsErrors:0, screenshot:shot});
      await ctx.close();
    }
  } finally { await browser.close() }
}

(async()=>{
 try{
   await useEngine(chromium,'chrome',[1440,820,390,360,320]);
   await useEngine(webkit,'webkit',[390,320]);
   report.status='PASS';
 } catch(e) {report.status='FAIL';report.errors.push(String(e.stack||e));process.exitCode=1;}
 finally{
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
  console.log('WASHER_PUBLIC_SMOKE '+JSON.stringify({...report,chrome:report.chrome.length,webkit:report.webkit.length}));
 }
})();