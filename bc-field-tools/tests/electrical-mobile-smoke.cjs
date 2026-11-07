"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 page.on("dialog",dialog=>dialog.accept());
 try{
  await page.goto("http://127.0.0.1:8765/bc-field-tools/?view=estimate",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.BCFDCasePersistence?.getRuntime()?.storageOk && window.BCEstimate);
  await page.locator('[data-cat="軽い電気工事"]').click();
  const circuit=page.locator('[data-item="dedicated_std"]');
  assert.equal(await circuit.isVisible(),true);
  await circuit.click();
  assert.equal(await page.locator('[data-item="dedicated_std"]').getAttribute("aria-pressed"),"true");
  await page.locator('[data-item="volt_change"]').click();
  assert.equal(await page.locator('[data-item="volt_change"]').getAttribute("aria-pressed"),"false","double counting was blocked");
  const selected=page.locator("#est-selected");
  assert.match(await selected.innerText(),/22,000/);
  assert.doesNotMatch(await selected.innerText(),/27,500/);
  await page.locator("#save-top-btn").click();
  await page.waitForFunction(()=>document.getElementById("save-status").textContent.includes("保存済み"),null,{timeout:20000});
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.BCFDCasePersistence?.getRuntime()?.storageOk && window.BCFDApp);
  await page.locator("#tab-estimate").click();
  assert.match(await page.locator("#est-selected").innerText(),/22,000/,"reopened case preserved new quote");
  assert.deepEqual(errors,[]);
  console.log("ELECTRICAL_MOBILE_E2E: PASS / selected new circuit, collision blocked, saved & reopened");
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error("ELECTRICAL_MOBILE_E2E: FAIL",e);process.exitCode=1;});
