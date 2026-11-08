'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),pw=require('playwright');
const out=path.join(process.cwd(),'output','bc-aircon-bantou-live-qa');fs.mkdirSync(out,{recursive:true});
function probe(port){return new Promise(resolve=>{const q=http.get('http://127.0.0.1:'+port+'/json/version',res=>{let s='';res.on('data',v=>s+=v);res.on('end',()=>{try{resolve(JSON.parse(s).webSocketDebuggerUrl?'http://127.0.0.1:'+port:null)}catch{resolve(null)}})});q.on('error',()=>resolve(null));q.setTimeout(300,()=>{q.destroy();resolve(null)})})}
async function main(){
 let cdp=null;for(const port of [9222,9223,9224,9333,9225,9226,9227,9228,9229,9230,9231,9232,9233,9234,9235,9236,9237,9238,9239]){cdp=await probe(port);if(cdp)break}
 if(!cdp)throw Error('BrowserBantou shared Chrome CDP unavailable; no fallback');
 const browser=await pw.chromium.connectOverCDP(cdp,{timeout:15000}),rows=[];
 try{
  for(const [w,h] of [[1440,900],[390,844],[320,700]]){
   const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1});const page=await ctx.newPage();let errors=[],failed=[];
   page.on('pageerror',e=>errors.push(String(e).slice(0,200)));
   page.on('requestfailed',r=>failed.push({url:r.url().slice(0,170),message:r.failure()?.errorText}));
   const res=await page.goto('https://teruya1229.github.io/aircon/',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForTimeout(1200);
   for(const img of await page.locator('img').all()){try{await img.scrollIntoViewIfNeeded({timeout:1000});await page.waitForTimeout(55)}catch{}}
   await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(450);
   const d=await page.evaluate(()=>{
    const names=['header','.brand','.brand__mark','.hero','.hero__grid','.hero__copy','.hero__media','.hero__experience','.hero__visual','.hero__person','.diagnosis','.section--choices','.section--voices','.section--policy','.section--faq','.final','.mobile-cta','footer'];
    const boxes=names.map(sel=>{let e=document.querySelector(sel);if(!e)return null;let r=e.getBoundingClientRect(),c=getComputedStyle(e);return {sel,x:Math.round(r.x),top:Math.round(r.top+scrollY),w:Math.round(r.width),h:Math.round(r.height),right:Math.round(r.right),font:c.fontSize,display:c.display}}).filter(Boolean);
    return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,fullHeight:document.documentElement.scrollHeight,brand:document.querySelector('.brand')?.outerHTML.slice(0,400),boxes,imgs:[...document.images].map(x=>({src:x.currentSrc.slice(0,160),naturalWidth:x.naturalWidth,complete:x.complete})),overflow:[...document.querySelectorAll('body *')].filter(e=>{let r=e.getBoundingClientRect();return r.width>0&&r.x>=0&&r.right>innerWidth+8&&getComputedStyle(e).position==='static'}).slice(0,12).map(e=>({tag:e.tagName,className:typeof e.className==='string'?e.className.slice(0,70):'',right:Math.round(e.getBoundingClientRect().right)}))};
   });
   await page.screenshot({path:path.join(out,'aircon-'+w+'.png'),fullPage:true,timeout:20000,animations:'disabled'});
   rows.push({w,h,http:res?.status(),...d,errors,failed});
   console.log('BANTOU_VIEWPORT '+JSON.stringify({w,http:res?.status(),scrollWidth:d.scrollWidth,fullHeight:d.fullHeight,boxes:d.boxes,imgs:d.imgs,overflow:d.overflow,errors,failed}));
   await ctx.close();
  }
  const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage();
  await page.goto('https://teruya1229.github.io/washing-machine-cleaning/',{waitUntil:'domcontentloaded',timeout:30000});
  const canonical=await page.locator('header .brand').first().evaluate(e=>e.outerHTML.slice(0,400)).catch(()=>null);
  rows.push({canonical});console.log('BANTOU_CANONICAL '+canonical);await ctx.close();
 }finally{try{await browser.close()}catch{}}
 fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify({cdp,rows},null,2));console.log('BANTOU_SUCCESS');
}
main().catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack||e));console.error('BANTOU_FAIL '+String(e.stack||e));process.exitCode=1});