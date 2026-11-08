'use strict';
const {chromium}=require('playwright');
const target='https://teruya1229.github.io/aircon/?debug=1&ga4qa=20261108';
function payload(url){let u;try{u=new URL(url)}catch{return null}if(!(/(^|\.)google-analytics\.com$|(^|\.)analytics\.google\.com$/.test(u.hostname)) || !u.pathname.endsWith('/g/collect'))return null;return {tid:u.searchParams.get('tid'),event:u.searchParams.get('en'),host:u.hostname}}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  const page=await ctx.newPage(), sent=[],responses=[],errors=[];
  page.on('request',r=>{const p=payload(r.url());if(p)sent.push(p)});
  page.on('response',r=>{const p=payload(r.url());if(p)responses.push({...p,status:r.status()})});
  page.on('pageerror',e=>errors.push(String(e).slice(0,200)));
  try{
    const http=await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(3800);
    const tag=await page.evaluate(()=>({build:document.querySelector('meta[name="lp-build"]')?.content,tagSrc:[...document.querySelectorAll('script[src]')].map(x=>x.src).find(x=>x.includes('gtag/js?id=G-X8LKLFDL3G'))||'',isDebug:new URLSearchParams(location.search).get('debug')==='1'}));
    await page.locator('a[data-cta-location="header"][href^="https://lin.ee/"]').click({timeout:12000});
    await page.waitForTimeout(1700);
    await page.locator('a[data-cta-location="bottom"][href^="tel:"]').click({timeout:12000});
    await page.waitForTimeout(2500);
    const matched=sent.filter(x=>x.tid==='G-X8LKLFDL3G'),got=responses.filter(x=>x.tid==='G-X8LKLFDL3G');
    const ev=[...new Set(matched.map(x=>x.event).filter(Boolean))];
    const result={http_status:http.status(),build:tag.build,gtag_present:Boolean(tag.tagSrc),debug_mode:tag.isDebug,request_events:ev,request_count:matched.length,response_events:got.map(x=>({event:x.event,status:x.status})),js_errors:errors};
    console.log('GA4_PRODUCTION_TRANSPORT_QA '+JSON.stringify(result));
    if(http.status()!==200||!tag.build?.includes('aircon-v14')||!tag.tagSrc||!tag.isDebug)throw Error('LP or tag not ready');
    for(const event of ['page_view','cta_click','line_click','phone_click'])if(!ev.includes(event))throw Error('GA4 request missing: '+event);
    if(errors.length)throw Error('JavaScript errors on LP');
    console.log('GA4_TRANSPORT_INITIATED_PASS; GA4_ADMIN_RECEIPT_NOT_PROVEN');
  }finally{await ctx.close();await browser.close()}
})().catch(e=>{console.error('GA4_TRANSPORT_QA_FAIL '+String(e.stack||e));process.exitCode=1});