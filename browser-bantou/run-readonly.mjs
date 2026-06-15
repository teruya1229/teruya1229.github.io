#!/usr/bin/env node
/**
 * ブラウザー番頭 MVP（read-only）
 *
 * - Google広告を永続Chromeプロファイルで開く
 * - 設定変更・クリック操作はしない
 * - 確認手順を表示し、広告番頭へ貼れるJSONテンプレートを出力
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  CONFIG,
  OUTPUT_DIR,
  PROFILE_DIR,
  getCampaign,
  resolveCampaignUrl,
  formatCheckedAt,
  buildAdBantouPayload,
  printChecklist,
  tryReadOverviewMetrics,
  capturePageMetadata,
  waitForEnter
} from './readonly-core.mjs';

function parseArgs(argv) {
  const campaignArg = argv.find(function (a) { return a.startsWith('--campaign='); });
  return {
    templateOnly: argv.includes('--template-only'),
    headless: argv.includes('--headless'),
    campaignId: campaignArg ? campaignArg.split('=')[1] : CONFIG.campaigns[0].id
  };
}

async function main() {
  var args = parseArgs(process.argv.slice(2));
  var campaign = getCampaign(args.campaignId);
  var navigation = resolveCampaignUrl(campaign);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  if (args.templateOnly) {
    var templateCheckedAt = formatCheckedAt();
    var template = buildAdBantouPayload(campaign, { autoRead: {
      cost: null, impressions: null, clicks: null, avgCpc: null, rawHints: ['template_only']
    }}, {
      ok: true,
      checkedAt: templateCheckedAt,
      pageUrl: null,
      pageTitle: null,
      screenshotPath: null,
      memo: 'テンプレート出力。ブラウザ起動なし。'
    }, navigation);
    var templatePath = join(OUTPUT_DIR, 'ad-bantou-template-' + campaign.id + '.json');
    writeFileSync(templatePath, JSON.stringify(template, null, 2), 'utf8');
    console.log('テンプレート出力:', templatePath);
    printChecklist(campaign, navigation);
    return;
  }

  printChecklist(campaign, navigation);

  console.log('Chromeプロファイル:', PROFILE_DIR);
  if (navigation.campaignUrlConfigured) {
    console.log('campaignUrl を開きます。ログイン済みならキャンペーン詳細へ直接移動します。\n');
  } else {
    console.log('初回はGoogleログインが必要です。ログイン後、キャンペーン画面まで手動で移動してください。\n');
  }

  var context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: args.headless,
    channel: 'chrome',
    viewport: { width: 1400, height: 900 },
    args: ['--disable-blink-features=AutomationControlled']
  });

  var page = context.pages()[0] || await context.newPage();

  try {
    await page.goto(navigation.openedUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Google広告を開きました:', navigation.openedUrl);
    console.log('read-only のため、スクリプトからのクリック・設定変更は行いません。\n');

    await waitForEnter();

    var autoRead = await tryReadOverviewMetrics(page);
    var pageMeta = await capturePageMetadata(page, campaign);
    var payload = buildAdBantouPayload(campaign, { autoRead: autoRead }, pageMeta, navigation);
    var outPath = join(OUTPUT_DIR, 'capture-' + campaign.id + '-' + Date.now() + '.json');
    writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

    console.log('\n=== 取得結果（best-effort） ===');
    console.log(JSON.stringify(payload, null, 2));
    console.log('\n保存先:', outPath);
    console.log('スクリーンショット:', pageMeta.screenshotPath);
    console.log('\n次の一手: 上記 JSON の adBantouDailyInput を広告番頭へ転記');
    console.log('初期設定チェックは', CONFIG.adBantouUrl, 'で手動記録');
  } finally {
    await context.close();
  }
}

main().catch(function (err) {
  console.error('browser-bantou エラー:', err.message);
  process.exit(1);
});
