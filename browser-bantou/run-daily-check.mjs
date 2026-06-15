#!/usr/bin/env node
/**
 * ブラウザー番頭 日次チェック（21時運用向け）
 *
 * complete_disassembly → ai_bantou を順番に read-only 実行し、
 * 一括JSONを出力・クリップボードコピー・広告番頭を開く。
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import {
  CONFIG,
  OUTPUT_DIR,
  PROFILE_DIR,
  DAILY_CAMPAIGN_IDS,
  getCampaign,
  resolveCampaignUrl,
  formatCheckedAt,
  formatTimestampForFilename,
  buildAdBantouPayload,
  buildDailyCheckBundle,
  printChecklist,
  tryReadOverviewMetrics,
  capturePageMetadata,
  waitForEnter
} from './readonly-core.mjs';

function copyTextToClipboardWindows(text) {
  var tmpPath = join(tmpdir(), 'browser-bantou-daily-' + Date.now() + '.json');
  writeFileSync(tmpPath, text, 'utf8');
  var escaped = tmpPath.replace(/'/g, "''");
  execSync(
    'powershell -NoProfile -Command "Get-Content -Raw -Encoding UTF8 \'' + escaped + '\' | Set-Clipboard"',
    { stdio: 'pipe' }
  );
}

function openAdBantouUrl() {
  var url = CONFIG.adBantouUrl;
  if (process.platform === 'win32') {
    execSync('start "" "' + url + '"', { stdio: 'ignore', shell: true });
    return;
  }
  console.log('広告番頭URL:', url);
}

async function captureCampaign(page, campaign, stepIndex, totalSteps) {
  var navigation = resolveCampaignUrl(campaign);
  printChecklist(campaign, navigation, {
    stepLabel: '【' + stepIndex + '/' + totalSteps + '】キャンペーン確認'
  });

  await page.goto(navigation.openedUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('Google広告を開きました:', navigation.openedUrl);
  console.log('read-only のため、スクリプトからのクリック・設定変更は行いません。\n');

  await waitForEnter();

  var autoRead = await tryReadOverviewMetrics(page);
  var pageMeta = await capturePageMetadata(page, campaign);
  return buildAdBantouPayload(campaign, { autoRead: autoRead }, pageMeta, navigation, {
    mode: 'daily-check'
  });
}

async function main() {
  console.log('=== ブラウザー番頭 日次チェック ===');
  console.log('対象:', DAILY_CAMPAIGN_IDS.join(' → '));
  console.log('Chromeプロファイル:', PROFILE_DIR);
  console.log('read-only のみ。設定変更・クリック操作は行いません。\n');

  var context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1400, height: 900 },
    args: ['--disable-blink-features=AutomationControlled']
  });

  var page = context.pages()[0] || await context.newPage();
  var payloads = [];

  try {
    for (var i = 0; i < DAILY_CAMPAIGN_IDS.length; i++) {
      var campaignId = DAILY_CAMPAIGN_IDS[i];
      var campaign = getCampaign(campaignId);
      var payload = await captureCampaign(page, campaign, i + 1, DAILY_CAMPAIGN_IDS.length);
      payloads.push(payload);

      var singlePath = join(OUTPUT_DIR, 'capture-' + campaign.id + '-' + Date.now() + '.json');
      writeFileSync(singlePath, JSON.stringify(payload, null, 2), 'utf8');
      console.log('\n個別JSON保存:', singlePath);
      console.log('スクリーンショット:', payload.screenshotPath);

      if (i < DAILY_CAMPAIGN_IDS.length - 1) {
        console.log('\n次のキャンペーンへ進みます...\n');
      }
    }
  } finally {
    await context.close();
  }

  var checkedAt = formatCheckedAt();
  var bundle = buildDailyCheckBundle(payloads, checkedAt);
  var latestPath = join(OUTPUT_DIR, 'daily-check-latest.json');
  var stampedPath = join(OUTPUT_DIR, 'daily-check-' + formatTimestampForFilename() + '.json');
  var bundleText = JSON.stringify(bundle, null, 2);

  writeFileSync(latestPath, bundleText, 'utf8');
  writeFileSync(stampedPath, bundleText, 'utf8');

  console.log('\n=== 日次チェック完了 ===');
  console.log('一括JSON:', latestPath);
  console.log('履歴JSON:', stampedPath);
  console.log('\n' + bundleText);

  if (process.platform === 'win32') {
    try {
      copyTextToClipboardWindows(bundleText);
      console.log('\nクリップボードに一括JSONをコピーしました。');
    } catch (e) {
      console.warn('\nクリップボードコピーに失敗しました:', e.message);
      console.warn('手動で', latestPath, 'をコピーしてください。');
    }
  } else {
    console.log('\nクリップボードコピーは Windows のみ対応です。');
  }

  try {
    openAdBantouUrl();
    console.log('広告番頭を開きました:', CONFIG.adBantouUrl);
    console.log('JSON読み込み欄へ貼り付けて、各件をフォームへ反映してください。');
  } catch (e) {
    console.warn('広告番頭を開けませんでした:', e.message);
    console.warn('手動で開いてください:', CONFIG.adBantouUrl);
  }
}

main().catch(function (err) {
  console.error('browser-bantou daily-check エラー:', err.message);
  process.exit(1);
});
