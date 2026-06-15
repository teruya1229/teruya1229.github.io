import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = __dirname;
export const CONFIG_PATH = join(ROOT, 'campaigns.json');
export const LOCAL_CONFIG_PATH = join(ROOT, 'campaigns.local.json');
export const PROFILE_DIR = join(ROOT, '.chrome-profile');
export const OUTPUT_DIR = join(ROOT, 'output');
export const CONFIG = loadConfig();

export const READ_ONLY_CHECKLIST = [
  '【read-only 確認】予算変更・停止・公開・削除は行わない',
  'Google広告で期間を「昨日」に設定する',
  '対象キャンペーンの一覧または詳細を開く',
  '費用・表示回数・クリック数・平均CPCをメモする',
  '広告のステータス（有効/一時停止/審査中）を目視確認する',
  'コンバージョン目標・入札戦略は設定画面を開いて目視確認（自動取得は未対応）',
  'LP URL・広告文・アセットは広告番頭の初期設定チェッカーで手動記録',
  '下記 output JSON を広告番頭の「今日の入力」へ転記する'
];

export const MANUAL_FIELDS = [
  'campaignStatus',
  'bidStrategy',
  'conversionGoal',
  'lpUrl',
  'adStatus',
  'conversionSettingsNote'
];

export const DAILY_CAMPAIGN_IDS = ['complete_disassembly', 'ai_bantou'];

export function loadConfig() {
  var config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  var localOverrides = {};
  if (existsSync(LOCAL_CONFIG_PATH)) {
    localOverrides = JSON.parse(readFileSync(LOCAL_CONFIG_PATH, 'utf8'));
  }
  config.campaigns = config.campaigns.map(function (campaign) {
    var local = localOverrides[campaign.id];
    if (local && String(local.campaignUrl || '').trim()) {
      return Object.assign({}, campaign, { campaignUrl: String(local.campaignUrl).trim() });
    }
    return campaign;
  });
  return config;
}

export function getCampaign(campaignId) {
  return CONFIG.campaigns.find(function (c) { return c.id === campaignId; }) || CONFIG.campaigns[0];
}

export function resolveCampaignUrl(campaign) {
  var campaignUrl = String(campaign.campaignUrl || '').trim();
  if (campaignUrl) {
    return {
      openedUrl: campaignUrl,
      campaignUrlConfigured: true
    };
  }
  return {
    openedUrl: CONFIG.googleAdsOverviewUrl,
    campaignUrlConfigured: false
  };
}

export function yesterdayIso() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

export function formatTimestampForFilename(date) {
  var d = date || new Date();
  return d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') + '-' +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') +
    String(d.getSeconds()).padStart(2, '0');
}

export function formatCheckedAt(date) {
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

export function buildAdBantouPayload(campaign, snapshot, pageMeta, navigation, options) {
  var opts = options || {};
  var mode = opts.mode || 'read-only';
  var checkedAt = pageMeta.checkedAt || formatCheckedAt();
  return {
    ok: pageMeta.ok !== false,
    source: 'browser-bantou',
    mode: mode,
    checkedAt: checkedAt,
    capturedAt: checkedAt,
    targetDate: yesterdayIso(),
    campaignId: campaign.id,
    campaignName: campaign.name,
    lpType: campaign.lpType,
    expectedLpUrl: campaign.expectedLpUrl,
    openedUrl: navigation.openedUrl,
    campaignUrlConfigured: navigation.campaignUrlConfigured,
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

export function buildDailyCheckBundle(items, checkedAt) {
  return {
    source: 'browser-bantou',
    mode: 'daily-check',
    checkedAt: checkedAt || formatCheckedAt(),
    items: items.map(function (payload) {
      return {
        campaignId: payload.campaignId,
        campaignName: payload.campaignName,
        adBantouDailyInput: payload.adBantouDailyInput
      };
    })
  };
}

export function printChecklist(campaign, navigation, options) {
  var opts = options || {};
  console.log('\n=== ブラウザー番頭 read-only 確認手順 ===\n');
  if (opts.stepLabel) {
    console.log(opts.stepLabel);
  }
  console.log('対象キャンペーン:', campaign.name);
  console.log('期待LP:', campaign.expectedLpUrl);
  console.log('開くURL:', navigation.openedUrl);
  console.log('campaignUrl設定:', navigation.campaignUrlConfigured ? 'あり' : 'なし（overview）');
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

export async function tryReadOverviewMetrics(page) {
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

export async function capturePageMetadata(page, campaign) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
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

export function waitForEnter(prompt) {
  console.log(prompt || '確認が終わったら、このターミナルで Enter を押してください...');
  return new Promise(function (resolve) {
    process.stdin.resume();
    process.stdin.once('data', resolve);
  });
}
