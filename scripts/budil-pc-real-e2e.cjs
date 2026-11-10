'use strict';
// Dedicated ephemeral Windows browser acceptance. No user Chrome or account data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');

const publicOrigin='https://teruya1229.github.io';
const publicUrl=publicOrigin+'/budil/';
const expectedRunner='bc-bantou-dev';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safeState=x=>String(x||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,56);
const fail=(code)=>{console.log('BUDIL_PC_REAL_E2E=FAIL stage='+code);process.exitCode=1;};
let browser=null;
(async()=>{
  if(process.env.RUNNER_NAME!==expectedRunner)throw Error('RUNNER_NAME_MISMATCH');
  console.log('RUNNER_IDENTITY=MATCH');
  const health=await fetch('http://127.0.0.1:43821/health',{signal:AbortSignal.timeout(6000)});
  console.log('WORKER_HEALTH_HTTP='+health.status);
  assert.equal(health.status,200,'local_worker_unavailable');
  // Use installed Chrome; never launch another user's browser profile.
  const exe='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  browser=await chromium.launch({
    ...(fs.existsSync(exe)?{executablePath:exe}:{}),
    headless:true,timeout:30000
  });
  const context=await browser.newContext({viewport:{width:1365,height:850}});
  const page=await context.newPage();
  await page.goto(publicUrl,{waitUntil:'domcontentloaded',timeout:30000});
  console.log('PUBLISHED_PAGE=LOADED');
  await page.locator('#budil-gpt-open').waitFor({state:'visible',timeout:15000});
  const permissionBefore=await page.evaluate(async()=>{
    try{return (await navigator.permissions.query({name:'loopback-network'})).state;}
    catch{return 'unsupported';}
  });
  console.log('LOOPBACK_BEFORE='+safeState(permissionBefore));
  let method='none';
  const cdp=await context.newCDPSession(page);
  try{
    await cdp.send('Browser.grantPermissions',{permissions:['loopbackNetwork'],origin:publicOrigin});
    method='Browser.grantPermissions';
  }catch(_){
    await cdp.send('Browser.setPermission',{
      permission:{name:'loopback-network'},setting:'granted',origin:publicOrigin
    });
    method='Browser.setPermission';
  }
  console.log('TEST_PERMISSION_METHOD='+method);
  const permissionAfter=await page.evaluate(async()=>{
    try{return (await navigator.permissions.query({name:'loopback-network'})).state;}
    catch{return 'unsupported';}
  });
  console.log('LOOPBACK_AFTER='+safeState(permissionAfter));
  await page.locator('#budil-gpt-open').click({timeout:10000});
  await page.locator('#budil-gpt-input').fill('2026-11-08の9時空いてる？');
  await page.locator('#budil-gpt-consent').check();
  await page.locator('#budil-gpt-run').click();
  await page.waitForFunction(()=>{
    const el=document.querySelector('#budil-gpt-google-read');
    return !!el&&!el.hidden;
  },null,{timeout:13000});
  console.log('GPT_GOOGLE_READ_PANEL=VISIBLE');
  await page.locator('#budil-gpt-google-consent').check();
  await page.locator('#budil-gpt-google-check').click();
  // Wait for the pending message to be replaced, never collect event content.
  let kind='timeout',overlap=-1;
  for(let i=0;i<80;i++){
    const text=await page.locator('#budil-gpt-google-status').innerText();
    const m=/重なる予定が(\d+)件/.exec(text);
    if(m){kind='conflict';overlap=Number(m[1]);break;}
    if(text.includes('local_calendar_')){kind='local_calendar_unavailable';break;}
    if(text.includes('空き確定にはしません')||text.includes('確認できません')){kind='read_failed';break;}
    if(text.includes('見つかりませんでした')){kind='zero_overlap';overlap=0;break;}
    await sleep(200);
  }
  console.log('GPT_BUSY_RESULT='+kind);
  console.log('GPT_BUSY_OVERLAPS='+overlap);
  const desktop=await page.evaluate(()=>({
    overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)
  }));
  console.log('DESKTOP_1365_OVERFLOW_PX='+desktop.overflow);
  await page.setViewportSize({width:390,height:844});
  const mobile=await page.evaluate(()=>({
    overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)
  }));
  console.log('MOBILE_390_OVERFLOW_PX='+mobile.overflow);
  assert.equal(kind,'conflict','expected_busy_conflict_not_displayed');
  assert.equal(overlap,1,'expected_one_overlap');
  assert.ok(desktop.overflow<=2&&mobile.overflow<=2,'layout_overflow');
  console.log('BUDIL_PC_REAL_E2E=PASS');
})().catch(error=>{
  // Do not print exception messages, URL bodies or session context.
  fail(safeState(error&&error.name||'RUN_ERROR'));
}).finally(async()=>{
  if(browser)await browser.close().catch(()=>{});
});
