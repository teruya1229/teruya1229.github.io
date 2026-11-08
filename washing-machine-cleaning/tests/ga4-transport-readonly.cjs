'use strict';
/* Read-only transport check: all outgoing GA4 collect calls are blocked, not sent. */
const { chromium } = require('playwright');
const fs=require('node:fs'), path=require('node:path');
const base='https://teruya1229.github.io/washing-machine-cleaning/';
const out=path.resolve(process.env.RUNNER_TEMP||process.cwd(),'washer-ga4-transport');
fs.mkdirSync(out,{recursive:true});
const entries=[];
function safeInfo(url){
  try{const u=new URL(url);return {host:u.hostname,path:u.pathname}}catch(_){return {host:'invalid',path:''}}
}
(async()=>{
const b=await chromium.launch({headless:true});
try{
 for(const variation of [
   {label:'regular',url:base+'?utm_source=instagram&utm_medium=paid_social'},
   {label:'debug',url:base+'?utm_source=instagram&utm_medium=paid_social&debug=1'}
 ]){
  const context=await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage();
  const row={case:variation.label,urlKind:'published LP',gtagjsStatus:null,events:[],blockedGa4Transport:[],googleTagResponses:[],failed:[],consoleWarnings:[],errors:[]};
  await page.route('**/*', route=>{
    const u=safeInfo(route.request().url());
    const analyticsHost=u.host==='google-analytics.com'||u.host.endsWith('.google-analytics.com');
    if(analyticsHost) {
      row.blockedGa4Transport.push({host:u.host,path:u.path,method:route.request().method()});
      return route.abort('blockedbyclient');
    }
    // Do not load external embedded videos during diagnostics.
    if(u.host==='youtube.com'||u.host.endsWith('.youtube.com')||u.host.endsWith('.youtube-nocookie.com'))return route.abort('blockedbyclient');
    return route.continue();
  });
  page.on('pageerror',e=>row.errors.push(String(e.message).slice(0,200)));
  page.on('console',msg=>{if(['warning','error'].includes(msg.type()))row.consoleWarnings.push(msg.text().slice(0,220))});
  page.on('response',r=>{
    const u=safeInfo(r.url());
    if(u.host==='www.googletagmanager.com'&&u.path==='/gtag/js')row.gtagjsStatus=r.status();
    if(u.host.includes('google'))row.googleTagResponses.push({host:u.host,path:u.path,status:r.status()})
  });
  page.on('requestfailed',r=>{
    const u=safeInfo(r.url());
    if(u.host.includes('google')&&!row.blockedGa4Transport.some(x=>x.host===u.host&&x.path===u.path))
      row.failed.push({host:u.host,path:u.path,error:r.failure()?.errorText||''});
  });
  const response=await page.goto(variation.url,{waitUntil:'domcontentloaded',timeout:45000});
  row.pageStatus=response?.status()||0;
  await page.waitForTimeout(9000);
  const before=await page.evaluate(()=>({
    gtagType:typeof window.gtag,
    gtmType:typeof window.google_tag_manager,
    dataLayerLength:(window.dataLayer||[]).length,
    ga4TagIdPresent:!!document.querySelector('script[src*="gtag/js?id=G-X8LKLFDL3G"]'),
    visibility:document.visibilityState,
    doNotTrack:navigator.doNotTrack||'unset',
    diagnosisForm:!!document.getElementById('washer-diagnosis-form'),
    scriptComplete:[...document.scripts].filter(s=>(s.src||'').includes('gtag/js')).map(s=>s.readyState||'n/a')
  }));
  row.before=before;
  await page.locator('input[name="washer_type"][value="drum"]').check();
  await page.locator('select[name="usage_age"]').selectOption('1to4');
  await page.locator('select[name="symptom"]').selectOption('drying');
  await page.locator('button.washer-diagnosis__submit').click();
  await page.waitForTimeout(7000);
  row.events=await page.evaluate(()=>(window.dataLayer||[]).filter(e=>e&&e[0]==='event').map(e=>String(e[1])));
  row.after=await page.evaluate(()=>({
    dataLayerLength:(window.dataLayer||[]).length,
    googleTagManagerPresent:!!window.google_tag_manager,
    gtagType:typeof window.gtag
  }));
  entries.push(row);
  await context.close();
 }
}catch(e){entries.push({fatal:String(e.stack||e).slice(0,1200)});process.exitCode=1}
finally{await b.close()}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(entries,null,2));
console.log('GA4_TRANSPORT_READONLY '+JSON.stringify(entries).slice(0,10000));
})();
