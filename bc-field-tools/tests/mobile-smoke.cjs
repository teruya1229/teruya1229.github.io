'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  try {
    await page.goto('http://127.0.0.1:8765/bc-field-tools/?view=field', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const rt = window.BCFDCasePersistence && window.BCFDCasePersistence.getRuntime();
      return rt && rt.storageOk && rt.caseId && window.BCFDApp && window.BCFDPhotoDevice;
    }, { timeout: 30000 });
    const save = page.locator('#save-top-btn');
    assert.equal(await save.isVisible(), true, 'header save is visible');
    assert.equal(await save.isEnabled(), true, 'save is enabled after case boot');

    await page.locator('#case-name').fill('UIテスト専用案件');
    await page.locator('#site-memo').fill('保存後も残る現場メモ');
    await save.click();
    await page.waitForFunction(() => document.getElementById('save-status').textContent.includes('保存済み'), null, { timeout: 20000 });
    assert.equal(await page.locator('#case-name').inputValue(), 'UIテスト専用案件');
    console.log('MOBILE_PASS: visible save, success feedback');

    const file = {
      name: '现场-photo.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Hk0AAAAASUVORK5CYII=', 'base64')
    };
    await page.locator('[data-photo-id="panel-overview"] [data-action="file-camera"]').setInputFiles(file);
    await page.locator('[data-photo-id="panel-overview"] [data-action="preview-photo"]').waitFor();
    const thumb = page.locator('[data-photo-id="panel-overview"] .thumb');
    assert.ok((await thumb.boundingBox()).height >= 189, 'mobile preview is taller than old 92px');
    const imageFit = await page.locator('[data-photo-id="panel-overview"] .thumb img').evaluate(el => getComputedStyle(el).objectFit);
    assert.equal(imageFit, 'contain', 'photo is not cropped');
    await page.locator('[data-photo-id="panel-overview"] [data-action="preview-photo"]').click();
    assert.equal(await page.locator('#photo-viewer-overlay').isVisible(), true, 'large viewer opens');
    await page.locator('#photo-viewer-image').evaluate(async img => {
      if (!img.complete) await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
      if (!img.naturalWidth) throw new Error('preview image failed to load');
    });
    await page.locator('#photo-viewer-close').click();
    assert.equal(await page.locator('#photo-viewer-overlay').isHidden(), true, 'large viewer closes');
    console.log('MOBILE_PASS: photo original preview, contain and overlay');

    await save.click();
    await page.waitForFunction(() => document.getElementById('save-status').textContent.includes('保存済み'), null, { timeout: 20000 });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => {
      const rt = window.BCFDCasePersistence && window.BCFDCasePersistence.getRuntime();
      return rt && rt.storageOk && rt.caseId &&
        document.getElementById('case-name').value === 'UIテスト専用案件';
    }, null, {timeout: 20000});
    assert.equal(await page.locator('#site-memo').inputValue(), '保存後も残る現場メモ');
    await page.locator('[data-photo-id="panel-overview"] [data-action="preview-photo"]').waitFor();
    console.log('MOBILE_PASS: case and photo persist across reload');

    const out = process.env.RUNNER_TEMP || '/tmp';
    await page.screenshot({path:path.join(out,'bc-field-mobile.png'), fullPage:false});
    await page.locator('[data-photo-id="panel-overview"] [data-action="preview-photo"]').click();
    await page.screenshot({path:path.join(out,'bc-field-preview.png'), fullPage:false});
    await page.locator('#photo-viewer-close').click();

    await page.evaluate(() => Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));
    const pendingDownload = page.waitForEvent('download', {timeout:10000});
    await page.locator('[data-photo-id="panel-overview"] [data-action="save-device"]').click();
    const download = await pendingDownload;
    assert.equal(download.suggestedFilename(),'现场-photo.png','filename remains original');
    const downloadPath = await download.path();
    assert.deepEqual(fs.readFileSync(downloadPath), file.buffer, 'original byte content retained');
    console.log('MOBILE_PASS: original image download and device save fallback');

    assert.deepEqual(errors,[], 'no uncaught page errors');
    console.log('MOBILE_E2E: PASS');
  } finally {
    await context.close();
    await browser.close();
  }
}
run().catch(e=>{console.error('MOBILE_E2E: FAIL',e);process.exitCode=1;});
