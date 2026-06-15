#!/usr/bin/env node
/**
 * ブラウザー番頭 MVP（read-only）
 *
 * - Google広告を永続Chromeプロファイルで開く
 * - 設定変更・クリック操作はしない
 * - 確認手順を表示し、広告番頭へ貼れるJSONテンプレートを出力
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'campaigns.json'), 'utf8'));
const PROFILE_DIR = join(ROOT, '.chrome-profile');
const OUTPUT_DIR = join(ROOT, 'output');

const READ_ONLY_CHECKLIST = [
  '【read-only 確認】予算変更・停止・公開・削除は行わない',
  'Google広告で期間を「昨日」に設定する',
  '対象キャンペーンの一覧または詳細を開く',
  '費用・表示回数・クリック数・平均CPCをメモする',
  '広告のステータス（有効/一時停止/審査中）を目視確認する',
  'コンバージョン目標・入札戦略は設定画面を開いて目視確認（自動取得は未対応）',
  'LP URL・広告文・アセットは広告番頭の初期設定チェッカーで手動記録',
  '下記 output JSON を広告番頭の「今日の入力」へ転記する'
];

const MANUAL_FIELDS = [
  'campaignStatus',
  'bidStrategy',
  'conversionGoal',
  'lpUrl',
  'adStatus',
  'conversionSettingsNote'
];

function parseArgs(argv) {
  const campaignArg = argv.find(function (a) { return a.startsWith('--campaign='); });
  return {
    templateOnly: argv.includes('--template-only'),
    headless: argv.includes('--headless'),
    campaignId: campaignArg ? campaignArg.split('=')[1] : CONFIG.campaigns[0].id
  };
}

function getCampaign(campaignId) {
  return CONFIG.campaigns.find(function (c) { return c.id === campaignId; }) || CONFIG.campaigns[0];
}

function yesterdayIso() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function formatTimestampForFilename(date) {
  var d = date || new Date();
  return d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') + '-' +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') +
    String(d.getSeconds()).padStart(2, '0');
}

function formatCheckedAt(date) {
  var d = date || new Date();
  var offsetMin = -d.getTimezoneOffset();
  var sign = offsetMin >= 0 ? '+' : '-';
  var abs = Math.abs(offsetMin);
  var hh = String(Math.floor(abs / 60)).padStart(2, '0');
  var mm = String(abs % 60).padStart(2, '0');
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + 'T' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0') +
    sign + hh + ':' + mm;
}

function buildAdBantouPayload(campaign, snapshot, pageMeta) {
  var checkedAt = pageMeta.checkedAt || formatCheckedAt();
  return {
    ok: pageMeta.ok !== false,
    source: 'browser-bantou',
    mode: 'read-only',
    checkedAt: checkedAt,
    capturedAt: checkedAt,
    targetDate: yesterdayIso(),
    campaignId: campaign.id,
    campaignName: campaign.name,
    lpType: campaign.lpType,
    expectedLpUrl: campaign.expectedLpUrl,
    pageUrl: pageMeta.pageUrl,
    pageTitle: pageMeta.pageTitle,
    screenshotPath: pageMeta.screenshotPath,
    autoRead: snapshot.autoRead,
    manualRequired: MANUAL_FIELDS,
    adBantouDailyInput: {
      date: yesterdayIso(),
      lpType: campaign.lpType,
      campaignName: campaign.name,
      cost: snapshot.autoRead.cost,
      impressions: snapshot.autoRead.impressions,
      clicks: snapshot.autoRead.clicks,
      avgCpc: snapshot.autoRead.avgCpc,
      ctaClicks: null,
      inquiries: null,
      conversions: null,
      revenue: null,
      memo: 'browser-bantou read-only で取得。CTA・問い合わせ・成約は手動入力。'
    },
    memo: pageMeta.memo,
    setupCheckerHints: {
      note: '初期設定の4状態チェックは広告番頭の Google広告 初期設定チェッカーで記録',
      adBantouUrl: CONFIG.adBantouUrl
    }
  };
}

function printChecklist(campaign) {
  console.log('\n=== ブラウザー番頭 read-only 確認手順 ===\n');
  console.log('対象キャンペーン:', campaign.name);
  console.log('期待LP:', campaign.expectedLpUrl);
  console.log('広告番頭:', CONFIG.adBantouUrl);
  console.log('');
  READ_ONLY_CHECKLIST.forEach(function (line, i) {
    console.log((i + 1) + '. ' + line);
  });
  console.log('\n--- 手動確認が必要な項目 ---');
  MANUAL_FIELDS.forEach(function (field) {
    console.log('- ' + field);
  });
  console.log('');
}

async function tryReadOverviewMetrics(page) {
  var result = {
    cost: null,
    impressions: null,
    clicks: null,
    avgCpc: null,
    rawHints: []
  };

  try {
    var bodyText = await page.evaluate(function () {
      return document.body ? document.body.innerText.slice(0, 12000) : '';
    });
    if (!bodyText) return result;

    var patterns = [
      { key: 'impressions', re: /表示回数[^\d]*([\d,]+)/ },
      { key: 'clicks', re: /クリック数[^\d]*([\d,]+)/ },
      { key: 'cost', re: /費用[^\d]*([\d,]+)/ },
      { key: 'avgCpc', re: /平均クリック単価[^\d]*([\d,.]+)/ }
    ];

    patterns.forEach(function (p) {
      var m = bodyText.match(p.re);
      if (m) {
        var num = parseFloat(m[1].replace(/,/g, ''));
        if (isFinite(num)) result[p.key] = num;
      }
    });

    if (bodyText.indexOf('ログイン') !== -1 || bodyText.indexOf('Sign in') !== -1) {
      result.rawHints.push('login_required');
    }
  } catch (e) {
    result.rawHints.push('read_error:' + e.message);
  }

  return result;
}

async function capturePageMetadata(page, campaign) {
  var now = new Date();
  var checkedAt = formatCheckedAt(now);
  var pageUrl = page.url();
  var pageTitle = await page.title();
  var screenshotFile = 'screenshot-' + campaign.id + '-' + formatTimestampForFilename(now) + '.png';
  var screenshotAbsPath = join(OUTPUT_DIR, screenshotFile);
  await page.screenshot({ path: screenshotAbsPath, fullPage: false });
  return {
    ok: true,
    checkedAt: checkedAt,
    pageUrl: pageUrl,
    pageTitle: pageTitle,
    screenshotPath: 'output/' + screenshotFile,
    memo: 'Google広告ページを開き、URL・タイトル・スクリーンショットを保存しました。'
  };
}

async function main() {
  var args = parseArgs(process.argv.slice(2));
  var campaign = getCampaign(args.campaignId);

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
    });
    var templatePath = join(OUTPUT_DIR, 'ad-bantou-template-' + campaign.id + '.json');
    writeFileSync(templatePath, JSON.stringify(template, null, 2), 'utf8');
    console.log('テンプレート出力:', templatePath);
    printChecklist(campaign);
    return;
  }

  printChecklist(campaign);

  console.log('Chromeプロファイル:', PROFILE_DIR);
  console.log('初回はGoogleログインが必要です。ログイン後、キャンペーン画面まで手動で移動してください。\n');

  var context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: args.headless,
    channel: 'chrome',
    viewport: { width: 1400, height: 900 },
    args: ['--disable-blink-features=AutomationControlled']
  });

  var page = context.pages()[0] || await context.newPage();

  try {
    await page.goto(CONFIG.googleAdsOverviewUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Google広告を開きました。ブラウザで画面を確認してください。');
    console.log('read-only のため、スクリプトからのクリック・設定変更は行いません。\n');
    console.log('確認が終わったら、このターミナルで Enter を押してください...');

    await new Promise(function (resolve) {
      process.stdin.resume();
      process.stdin.once('data', resolve);
    });

    var autoRead = await tryReadOverviewMetrics(page);
    var pageMeta = await capturePageMetadata(page, campaign);
    var payload = buildAdBantouPayload(campaign, { autoRead: autoRead }, pageMeta);
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
