/* 広告番頭 MVP
 * 保存先: localStorage（キーは広告番頭専用）
 * 将来 Google Sheets / Airtable / Supabase / API 連携へ移行しやすいよう、
 * データはシンプルな JSON 配列で保持する。
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'bcAdBantouDailyLogs';
  var PREFLIGHT_STORAGE_KEY = 'bcAdBantouPreflightChecks';

  /* ===== ストレージ ===== */

  function loadLogs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveLogs(logs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  }

  /* ===== 計算（0除算は null を返す） ===== */

  function safeDiv(a, b) {
    if (!b || !isFinite(b)) return null;
    var v = a / b;
    return isFinite(v) ? v : null;
  }

  function computeMetrics(e) {
    return {
      ctr: safeDiv(e.clicks, e.impressions),
      ctaRate: safeDiv(e.ctaClicks, e.clicks),
      inquiryRate: safeDiv(e.inquiries, e.clicks),
      conversionRate: safeDiv(e.conversions, e.inquiries),
      cpa: safeDiv(e.cost, e.conversions),
      roas: safeDiv(e.revenue, e.cost),
      estimatedProfit: e.revenue - e.cost
    };
  }

  /* ===== 判定 ===== */

  var DECISION = {
    CONTINUE: '継続',
    IMPROVE: '改善',
    STOP: '停止候補',
    NO_DATA: 'データ不足'
  };

  function decide(e) {
    // 1) 継続：成約があり、売上が広告費を上回っている
    if (e.conversions >= 1 && e.revenue > e.cost) {
      return { label: DECISION.CONTINUE, reason: '成約あり・売上が広告費を上回っています。' };
    }
    // 2) データ不足：表示回数・クリック数が少なく判断できない
    if (e.impressions < 100 && e.clicks < 5) {
      return { label: DECISION.NO_DATA, reason: '表示回数100未満かつクリック数5未満のため、判断材料が不足しています。' };
    }
    // 3) 停止候補：費用とクリックがあるのに CTA または問い合わせが0
    if (e.cost > 0 && e.clicks > 0 && (e.ctaClicks === 0 || e.inquiries === 0)) {
      var why = e.ctaClicks === 0 ? 'CTAクリックが0' : '問い合わせが0';
      return { label: DECISION.STOP, reason: '広告費・クリックが発生していますが、' + why + 'です。LPまたはターゲティングの見直し候補です。' };
    }
    // 4) 改善：クリック・CTAクリックはあるが、問い合わせ・成約が少ない
    if (e.clicks > 0 && e.ctaClicks > 0) {
      return { label: DECISION.IMPROVE, reason: 'CTAクリックまではあるものの、問い合わせ・成約につながっていません。導線や訴求の改善余地があります。' };
    }
    // 5) フォールバック
    return { label: DECISION.NO_DATA, reason: '判断に必要なデータが揃っていません。' };
  }

  function decisionClass(label) {
    switch (label) {
      case DECISION.CONTINUE: return 'is-continue';
      case DECISION.IMPROVE: return 'is-improve';
      case DECISION.STOP: return 'is-stop';
      default: return 'is-nodata';
    }
  }

  /* ===== フォーマット ===== */

  function fmtYen(v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return Math.round(v).toLocaleString('ja-JP') + '円';
  }

  function fmtPct(v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return (v * 100).toFixed(1) + '%';
  }

  function fmtRatio(v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return v.toFixed(2);
  }

  function fmtNum(v) {
    return Number(v || 0).toLocaleString('ja-JP');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ===== DOM ===== */

  var form = document.getElementById('entry-form');
  var resultSection = document.getElementById('result-section');
  var decisionBox = document.getElementById('decision-box');
  var decisionLabel = document.getElementById('decision-label');
  var decisionReason = document.getElementById('decision-reason');
  var metricsBox = document.getElementById('metrics-box');
  var logTbody = document.getElementById('log-tbody');
  var logEmpty = document.getElementById('log-empty');
  var summaryTbody = document.getElementById('summary-tbody');
  var summaryEmpty = document.getElementById('summary-empty');

  function num(id) {
    var v = parseFloat(document.getElementById(id).value);
    return isFinite(v) && v >= 0 ? v : 0;
  }

  function readForm() {
    return {
      date: document.getElementById('f-date').value,
      lpType: document.getElementById('f-lp-type').value,
      campaignName: document.getElementById('f-campaign').value.trim(),
      cost: num('f-cost'),
      impressions: num('f-impressions'),
      clicks: num('f-clicks'),
      avgCpc: num('f-avg-cpc'),
      ctaClicks: num('f-cta-clicks'),
      inquiries: num('f-inquiries'),
      conversions: num('f-conversions'),
      revenue: num('f-revenue'),
      memo: document.getElementById('f-memo').value.trim()
    };
  }

  /* ===== 判定・計算結果の表示 ===== */

  var METRIC_DEFS = [
    { key: 'ctr', name: 'CTR（クリック率）', fmt: fmtPct },
    { key: 'ctaRate', name: 'CTA率', fmt: fmtPct },
    { key: 'inquiryRate', name: '問い合わせ率', fmt: fmtPct },
    { key: 'conversionRate', name: '成約率', fmt: fmtPct },
    { key: 'cpa', name: 'CPA（成約単価）', fmt: fmtYen },
    { key: 'roas', name: 'ROAS', fmt: fmtRatio },
    { key: 'estimatedProfit', name: '粗利目安', fmt: fmtYen }
  ];

  function renderResult(computed, decision) {
    resultSection.hidden = false;
    decisionBox.className = 'ab-decision ' + decisionClass(decision.label);
    decisionLabel.textContent = '判定：' + decision.label;
    decisionReason.textContent = decision.reason;

    metricsBox.innerHTML = METRIC_DEFS.map(function (d) {
      return '<div class="ab-metric">' +
        '<div class="ab-metric-name">' + d.name + '</div>' +
        '<div class="ab-metric-value">' + d.fmt(computed[d.key]) + '</div>' +
        '</div>';
    }).join('');
  }

  /* ===== 日別ログ ===== */

  function renderLogs(logs) {
    var sorted = logs.slice().sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });

    logTbody.innerHTML = sorted.map(function (e) {
      return '<tr>' +
        '<td>' + escapeHtml(e.date) + '</td>' +
        '<td>' + escapeHtml(e.lpType) + '</td>' +
        '<td>' + escapeHtml(e.campaignName || '—') + '</td>' +
        '<td>' + fmtYen(e.cost) + '</td>' +
        '<td>' + fmtNum(e.clicks) + '</td>' +
        '<td>' + fmtNum(e.ctaClicks) + '</td>' +
        '<td>' + fmtNum(e.inquiries) + '</td>' +
        '<td>' + fmtNum(e.conversions) + '</td>' +
        '<td>' + fmtYen(e.revenue) + '</td>' +
        '<td style="text-align:center;"><span class="ab-badge ' + decisionClass(e.decision) + '">' + escapeHtml(e.decision) + '</span></td>' +
        '<td class="memo-cell" title="' + escapeHtml(e.memo) + '">' + escapeHtml(e.memo || '—') + '</td>' +
        '<td style="text-align:center;"><button type="button" class="ab-delete-btn" data-id="' + escapeHtml(e.id) + '">削除</button></td>' +
        '</tr>';
    }).join('');

    logEmpty.style.display = sorted.length ? 'none' : 'block';
  }

  /* ===== LP別集計 ===== */

  function renderSummary(logs) {
    var groups = {};
    logs.forEach(function (e) {
      var key = e.lpType || 'その他';
      if (!groups[key]) {
        groups[key] = { lpType: key, cost: 0, impressions: 0, clicks: 0, ctaClicks: 0, inquiries: 0, conversions: 0, revenue: 0 };
      }
      var g = groups[key];
      g.cost += e.cost;
      g.impressions += e.impressions;
      g.clicks += e.clicks;
      g.ctaClicks += e.ctaClicks;
      g.inquiries += e.inquiries;
      g.conversions += e.conversions;
      g.revenue += e.revenue;
    });

    var rows = Object.keys(groups).map(function (key) {
      var g = groups[key];
      var d = decide(g);
      return '<tr>' +
        '<td>' + escapeHtml(g.lpType) + '</td>' +
        '<td>' + fmtYen(g.cost) + '</td>' +
        '<td>' + fmtNum(g.clicks) + '</td>' +
        '<td>' + fmtNum(g.ctaClicks) + '</td>' +
        '<td>' + fmtNum(g.inquiries) + '</td>' +
        '<td>' + fmtNum(g.conversions) + '</td>' +
        '<td>' + fmtYen(g.revenue) + '</td>' +
        '<td>' + fmtYen(safeDiv(g.cost, g.conversions)) + '</td>' +
        '<td>' + fmtRatio(safeDiv(g.revenue, g.cost)) + '</td>' +
        '<td style="text-align:center;"><span class="ab-badge ' + decisionClass(d.label) + '">' + escapeHtml(d.label) + '</span></td>' +
        '</tr>';
    });

    summaryTbody.innerHTML = rows.join('');
    summaryEmpty.style.display = rows.length ? 'none' : 'block';
  }

  function renderAll() {
    var logs = loadLogs();
    renderLogs(logs);
    renderSummary(logs);
  }

  /* ===== イベント ===== */

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();

    var entry = readForm();
    if (!entry.date || !entry.lpType) {
      alert('日付とLP種別は必須です。');
      return;
    }

    var computed = computeMetrics(entry);
    var decision = decide(entry);

    var record = {
      id: 'ab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      date: entry.date,
      lpType: entry.lpType,
      campaignName: entry.campaignName,
      cost: entry.cost,
      impressions: entry.impressions,
      clicks: entry.clicks,
      avgCpc: entry.avgCpc,
      ctaClicks: entry.ctaClicks,
      inquiries: entry.inquiries,
      conversions: entry.conversions,
      revenue: entry.revenue,
      memo: entry.memo,
      computed: computed,
      decision: decision.label
    };

    var logs = loadLogs();
    logs.push(record);
    saveLogs(logs);

    renderResult(computed, decision);
    renderAll();

    // 数値・メモのみリセット（日付・LP種別・キャンペーン名は連続入力しやすいよう保持）
    ['f-cost', 'f-impressions', 'f-clicks', 'f-avg-cpc', 'f-cta-clicks', 'f-inquiries', 'f-conversions', 'f-revenue'].forEach(function (id) {
      document.getElementById(id).value = '0';
    });
    document.getElementById('f-memo').value = '';
  });

  logTbody.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.ab-delete-btn');
    if (!btn) return;
    if (!confirm('このログを削除しますか？')) return;
    var id = btn.getAttribute('data-id');
    var logs = loadLogs().filter(function (e) { return e.id !== id; });
    saveLogs(logs);
    renderAll();
  });

  /* ===== 広告開始前チェック ===== */

  var PREFLIGHT_OK = '広告開始OK';
  var PREFLIGHT_NG = '広告開始前に要確認';

  var HOME_LP_KEYS = ['pageOk', 'lineCtaOk', 'airReserveCtaOk', 'layoutOk'];
  var COMPLETE_LP_KEYS = ['pageOk', 'lineCtaOk', 'phoneCtaOk', 'layoutOk'];

  var HOME_LP_LABELS = {
    pageOk: 'ページ表示OK',
    lineCtaOk: 'LINE CTA 計測OK',
    airReserveCtaOk: 'Airリザーブ CTA 計測OK',
    layoutOk: '表示崩れなし'
  };

  var COMPLETE_LP_LABELS = {
    pageOk: 'ページ表示OK',
    lineCtaOk: 'LINE CTA 計測OK',
    phoneCtaOk: '電話CTA 計測OK',
    layoutOk: '表示崩れなし'
  };

  var preflightForm = document.getElementById('preflight-form');
  var preflightDecisionBox = document.getElementById('preflight-decision-box');
  var preflightDecisionLabel = document.getElementById('preflight-decision-label');
  var preflightDecisionHint = document.getElementById('preflight-decision-hint');
  var preflightLatest = document.getElementById('preflight-latest');
  var preflightLatestBody = document.getElementById('preflight-latest-body');
  var preflightHistoryTbody = document.getElementById('preflight-history-tbody');
  var preflightHistoryEmpty = document.getElementById('preflight-history-empty');

  function loadPreflightChecks() {
    try {
      var raw = localStorage.getItem(PREFLIGHT_STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function savePreflightChecks(checks) {
    localStorage.setItem(PREFLIGHT_STORAGE_KEY, JSON.stringify(checks));
  }

  function allChecksOk(obj, keys) {
    return keys.every(function (k) { return obj[k] === true; });
  }

  function decidePreflight(homeLp, completeDisassemblyLp) {
    if (allChecksOk(homeLp, HOME_LP_KEYS) && allChecksOk(completeDisassemblyLp, COMPLETE_LP_KEYS)) {
      return PREFLIGHT_OK;
    }
    return PREFLIGHT_NG;
  }

  function preflightDecisionClass(decision) {
    return decision === PREFLIGHT_OK ? 'is-preflight-ok' : 'is-preflight-ng';
  }

  function readPreflightForm() {
    return {
      checkedAt: document.getElementById('pf-date').value,
      homeLp: {
        pageOk: document.getElementById('pf-home-pageOk').checked,
        lineCtaOk: document.getElementById('pf-home-lineCtaOk').checked,
        airReserveCtaOk: document.getElementById('pf-home-airReserveCtaOk').checked,
        layoutOk: document.getElementById('pf-home-layoutOk').checked
      },
      completeDisassemblyLp: {
        pageOk: document.getElementById('pf-complete-pageOk').checked,
        lineCtaOk: document.getElementById('pf-complete-lineCtaOk').checked,
        phoneCtaOk: document.getElementById('pf-complete-phoneCtaOk').checked,
        layoutOk: document.getElementById('pf-complete-layoutOk').checked
      },
      memo: document.getElementById('pf-memo').value.trim()
    };
  }

  function renderCheckSummary(obj, keys, labels) {
    return keys.map(function (k) {
      var cls = obj[k] ? 'is-ok' : 'is-ng';
      var mark = obj[k] ? 'OK' : '未';
      return '<span class="' + cls + '">' + escapeHtml(labels[k]) + '：' + mark + '</span>';
    }).join('<br>');
  }

  function updatePreflightPreview() {
    var entry = readPreflightForm();
    var decision = decidePreflight(entry.homeLp, entry.completeDisassemblyLp);
    preflightDecisionBox.className = 'ab-preflight-decision ' + preflightDecisionClass(decision);
    preflightDecisionLabel.textContent = decision;
    preflightDecisionHint.textContent = decision === PREFLIGHT_OK
      ? 'すべての必須チェックがOKです。保存して記録してください。'
      : '未チェックまたはNGの項目があります。すべてOKになるまで確認してください。';
  }

  function renderPreflightLatest(checks) {
    if (!checks.length) {
      preflightLatest.hidden = true;
      return;
    }

    var sorted = checks.slice().sort(function (a, b) {
      return a.checkedAt < b.checkedAt ? 1 : a.checkedAt > b.checkedAt ? -1 : 0;
    });
    var latest = sorted[0];

    preflightLatest.hidden = false;
    preflightLatestBody.innerHTML =
      '<div class="ab-preflight-latest-summary">' +
        '<span class="ab-preflight-latest-date">確認日：' + escapeHtml(latest.checkedAt) + '</span>' +
        '<span class="ab-badge ' + preflightDecisionClass(latest.decision) + '">' + escapeHtml(latest.decision) + '</span>' +
      '</div>' +
      '<p><strong>家庭LP：</strong></p>' +
      '<div class="ab-preflight-check-summary">' + renderCheckSummary(latest.homeLp, HOME_LP_KEYS, HOME_LP_LABELS) + '</div>' +
      '<p style="margin-top:8px;"><strong>完全分解LP：</strong></p>' +
      '<div class="ab-preflight-check-summary">' + renderCheckSummary(latest.completeDisassemblyLp, COMPLETE_LP_KEYS, COMPLETE_LP_LABELS) + '</div>' +
      (latest.memo ? '<p style="margin-top:8px;"><strong>メモ：</strong>' + escapeHtml(latest.memo) + '</p>' : '');
  }

  function renderPreflightHistory(checks) {
    var sorted = checks.slice().sort(function (a, b) {
      return a.checkedAt < b.checkedAt ? 1 : a.checkedAt > b.checkedAt ? -1 : 0;
    });

    preflightHistoryTbody.innerHTML = sorted.map(function (e) {
      return '<tr>' +
        '<td>' + escapeHtml(e.checkedAt) + '</td>' +
        '<td style="text-align:center;"><span class="ab-badge ' + preflightDecisionClass(e.decision) + '">' + escapeHtml(e.decision) + '</span></td>' +
        '<td><div class="ab-preflight-check-summary">' + renderCheckSummary(e.homeLp, HOME_LP_KEYS, HOME_LP_LABELS) + '</div></td>' +
        '<td><div class="ab-preflight-check-summary">' + renderCheckSummary(e.completeDisassemblyLp, COMPLETE_LP_KEYS, COMPLETE_LP_LABELS) + '</div></td>' +
        '<td class="memo-cell" title="' + escapeHtml(e.memo) + '">' + escapeHtml(e.memo || '—') + '</td>' +
        '<td style="text-align:center;"><button type="button" class="ab-delete-btn ab-preflight-delete-btn" data-id="' + escapeHtml(e.id) + '">削除</button></td>' +
        '</tr>';
    }).join('');

    preflightHistoryEmpty.style.display = sorted.length ? 'none' : 'block';
  }

  function renderPreflightAll() {
    var checks = loadPreflightChecks();
    renderPreflightLatest(checks);
    renderPreflightHistory(checks);
    updatePreflightPreview();
  }

  preflightForm.addEventListener('submit', function (ev) {
    ev.preventDefault();

    var entry = readPreflightForm();
    if (!entry.checkedAt) {
      alert('確認日は必須です。');
      return;
    }

    var decision = decidePreflight(entry.homeLp, entry.completeDisassemblyLp);
    var record = {
      id: 'pf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      checkedAt: entry.checkedAt,
      homeLp: entry.homeLp,
      completeDisassemblyLp: entry.completeDisassemblyLp,
      memo: entry.memo,
      decision: decision
    };

    var checks = loadPreflightChecks();
    checks.push(record);
    savePreflightChecks(checks);
    renderPreflightAll();
  });

  preflightForm.addEventListener('change', updatePreflightPreview);

  preflightHistoryTbody.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.ab-preflight-delete-btn');
    if (!btn) return;
    if (!confirm('このチェック履歴を削除しますか？')) return;
    var id = btn.getAttribute('data-id');
    var checks = loadPreflightChecks().filter(function (e) { return e.id !== id; });
    savePreflightChecks(checks);
    renderPreflightAll();
  });

  /* ===== Google広告 初期設定チェッカー ===== */

  var CAMPAIGN_SETUP_STORAGE_KEY = 'bcAdBantouCampaignSetupChecks';

  var CS_STATUS = {
    UNCHECKED: 'unchecked',
    OK: 'ok',
    NG: 'ng',
    NOT_APPLICABLE: 'not_applicable'
  };

  var CS_DECISION = {
    COMPLETE: '初期設定完了',
    NEEDS_FIX: '修正が必要',
    IN_PROGRESS: '確認途中'
  };

  var CS_STATUS_LABELS = {
    unchecked: '未確認',
    ok: 'OK',
    ng: 'NG',
    not_applicable: '対象外'
  };

  var CAMPAIGN_SETUP_GROUPS = [
    {
      id: 'lpUrl',
      title: '0. LP URL確認',
      items: [
        { id: 'lpUrlEntered', label: 'LP URLが入力されている', auto: true },
        { id: 'lpUrlMatches', label: '最終ページURLが期待値と一致している', auto: true },
        { id: 'sitelinkUrlCorrect', label: 'サイトリンクのURLが完全分解LPまたは関連するBCサービスのページになっている', campaigns: ['complete_disassembly'] },
        { id: 'noAiBantouLpUrlMixed', label: 'AI帳票番頭LPのURLが混ざっていない', campaigns: ['complete_disassembly'] },
        { id: 'noCompleteDisassemblyLpUrlMixed', label: '完全分解LPのURLが混ざっていない', campaigns: ['ai_bantou'] },
        { id: 'onlineServiceLpUrlCorrect', label: 'オンラインサービスとしてLP URLが正しい', campaigns: ['ai_bantou'] }
      ]
    },
    {
      id: 'basic',
      title: '1. 基本設定',
      items: [
        { id: 'campaignEnabled', label: 'キャンペーンが有効' },
        { id: 'startDateCorrect', label: '開始日が正しい' },
        { id: 'endDateCorrect', label: '終了日が意図どおり' },
        { id: 'dailyBudgetConfirmed', label: '1日予算が確認済み' },
        { id: 'billingNoWarning', label: '請求・支払いに警告なし' },
        { id: 'accountNoMajorWarning', label: 'アカウントに停止・本人確認などの重大警告なし' }
      ]
    },
    {
      id: 'delivery',
      title: '2. 配信条件',
      items: [
        { id: 'regionCorrect', label: '配信地域が正しい' },
        { id: 'regionDetailCorrect', label: '地域の詳細設定が正しい' },
        { id: 'languageJapanese', label: '言語が日本語' },
        { id: 'adScheduleCorrect', label: '広告スケジュールが正しい' },
        { id: 'searchNetworkEnabled', label: '検索ネットワークが有効' },
        { id: 'noUnintendedDisplay', label: '意図しないディスプレイ配信がない' }
      ]
    },
    {
      id: 'bidding',
      title: '3. 入札とコンバージョン',
      items: [
        { id: 'bidStrategyConfirmed', label: '入札戦略が確認済み' },
        { id: 'initialBidMaximizeClicks', label: '初期配信時は「クリック数の最大化」' },
        { id: 'noUnintendedMaxCpc', label: '上限クリック単価が意図せず設定されていない' },
        { id: 'campaignConversionGoal', label: 'キャンペーン固有のコンバージョン目標' },
        { id: 'correctConversionActionsOnly', label: '正しいコンバージョンアクションだけが含まれている' },
        { id: 'noOtherLpConversionMixed', label: '別LPのコンバージョンが混ざっていない' },
        { id: 'ga4ConnectionConfirmed', label: 'GA4との接続・イベント計測が確認済み' }
      ]
    },
    {
      id: 'keywords',
      title: '4. キーワード',
      items: [
        { id: 'keywordsExist', label: 'キーワードが1件以上ある' },
        { id: 'keywordsEnabled', label: 'ステータスが有効' },
        { id: 'matchTypeIntention', label: '完全一致・フレーズ一致の意図を確認' },
        { id: 'searchVolumeChecked', label: '検索ボリューム不足を確認' },
        { id: 'noUnwantedKeywords', label: '不要なキーワードが混ざっていない' },
        { id: 'negativeKeywordsChecked', label: '除外キーワードの有無を確認' }
      ]
    },
    {
      id: 'rsa',
      title: '5. レスポンシブ検索広告',
      items: [
        { id: 'singleActiveAd', label: '広告が1件だけ有効' },
        { id: 'noDuplicateAds', label: '重複した広告が残っていない' },
        { id: 'adApprovedOrPending', label: '広告が承認済みまたは審査中' },
        { id: 'finalUrlCorrect', label: '最終ページURLが正しい', auto: true },
        { id: 'headlines15', label: '見出し15件' },
        { id: 'descriptions4', label: '説明文4件' },
        { id: 'assetStrengthAboveAverage', label: '広告アセットの充実度が平均以上' },
        { id: 'noUnintendedPinning', label: '意図しないピン留めがない' }
      ]
    },
    {
      id: 'assets',
      title: '6. 広告アセット',
      items: [
        { id: 'sitelinks6Plus', label: 'サイトリンク6件以上' },
        { id: 'sitelinksHaveDescriptions', label: 'サイトリンクに説明文がある' },
        { id: 'callouts8Plus', label: 'コールアウト8件以上' },
        { id: 'structuredSnippetSet', label: '構造化スニペット設定済み' },
        { id: 'businessNameSet', label: 'ビジネス名設定済み' },
        { id: 'businessLogoSetOrPending', label: 'ビジネスロゴ設定済みまたは審査中' },
        { id: 'assetsAttachedToCorrectCampaign', label: 'アセットの追加先が正しいキャンペーン' },
        { id: 'noOtherCampaignAssetsMixed', label: '別キャンペーンのアセットが混ざっていない' }
      ]
    },
    {
      id: 'prelaunch',
      title: '7. 公開前確認',
      items: [
        { id: 'adPreviewDiagnosisDone', label: '広告プレビューと診断を実施' },
        { id: 'noSelfClickInSearch', label: '通常検索で自己クリックしていない' },
        { id: 'lpDisplaysCorrectly', label: 'LPが正常表示' },
        { id: 'ctaTrackingOk', label: 'CTA計測が正常' },
        { id: 'noConsoleErrors', label: 'コンソールエラーなし' },
        { id: 'noTestClicksInStats', label: 'テストクリックを実績に含めていない' }
      ]
    },
    {
      id: 'campaignSpecific',
      title: '8. キャンペーン固有',
      items: [
        { id: 'phoneAssetSet', label: '電話アセットが設定済み', campaigns: ['complete_disassembly'] },
        { id: 'callReportingEnabled', label: '通話レポートが有効', campaigns: ['complete_disassembly'] },
        { id: 'callConversionsInGoal', label: '広告経由の通話数が目標に含まれる', campaigns: ['complete_disassembly'] },
        { id: 'noAiBantouConversionMixed', label: 'AI帳票番頭用コンバージョンが混ざっていない', campaigns: ['complete_disassembly'] },
        { id: 'priceAssetNotApplicable', label: '価格アセットは対象外', campaigns: ['complete_disassembly'], defaultStatus: CS_STATUS.NOT_APPLICABLE },
        { id: 'priceAssets4Set', label: '価格アセット4件が設定済み', campaigns: ['ai_bantou'] },
        { id: 'phoneAssetNotApplicable', label: '電話アセットは対象外', campaigns: ['ai_bantou'], defaultStatus: CS_STATUS.NOT_APPLICABLE },
        { id: 'noCtaClickMixed', label: '完全分解用cta_clickが混ざっていない', campaigns: ['ai_bantou'] },
        { id: 'nationwideDelivery', label: '全国配信設定になっている', campaigns: ['ai_bantou'] }
      ]
    }
  ];

  var CAMPAIGN_DEFAULT_NA = {
    complete_disassembly: ['priceAssetNotApplicable'],
    ai_bantou: ['phoneAssetNotApplicable']
  };

  var csCampaignSelect = document.getElementById('cs-campaign-select');
  var csOtherFields = document.getElementById('cs-other-fields');
  var csOtherCampaignName = document.getElementById('cs-other-campaign-name');
  var csOtherExpectedLp = document.getElementById('cs-other-expected-lp');
  var csTemplateCard = document.getElementById('cs-template-card');
  var csProgressStats = document.getElementById('cs-progress-stats');
  var csOverallBox = document.getElementById('cs-overall-box');
  var csNextActionBox = document.getElementById('cs-next-action-box');
  var csLatest = document.getElementById('cs-latest');
  var csLatestBody = document.getElementById('cs-latest-body');
  var csCheckGroups = document.getElementById('cs-check-groups');
  var csLpUrl = document.getElementById('cs-lp-url');
  var csLpCompare = document.getElementById('cs-lp-compare');
  var csMemo = document.getElementById('cs-memo');
  var campaignSetupForm = document.getElementById('campaign-setup-form');
  var csHistoryTbody = document.getElementById('cs-history-tbody');
  var csHistoryEmpty = document.getElementById('cs-history-empty');
  var csHistoryCards = document.getElementById('cs-history-cards');
  var csResetBtn = document.getElementById('cs-reset-btn');
  var csLoadLatestBtn = document.getElementById('cs-load-latest-btn');

  var csCurrentCampaignType = 'complete_disassembly';
  var csFormDirty = false;

  function getCampaignTemplate(campaignType) {
    if (campaignType === 'complete_disassembly') {
      return {
        campaignType: 'complete_disassembly',
        campaignName: '完全分解_南部_検索_小額テスト',
        expectedLpUrl: 'https://teruya1229.github.io/complete-disassembly/',
        lpFixLabel: '完全分解LP',
        expectations: {
          lp: 'https://teruya1229.github.io/complete-disassembly/',
          bidStrategy: 'クリック数の最大化',
          budget: '1日1,000円',
          conversionGoal: '完全分解LP_問い合わせ',
          conversionActions: ['BCサービス LP (web) cta_click', '広告経由の通話数'],
          regions: ['南城市', '八重瀬町', '豊見城市', '糸満市', '那覇市', '南風原町', '与那原町'],
          regionOption: '対象地域に現在いる、または定期的にいるユーザー',
          sitelinks: '6件以上',
          callouts: '8件以上',
          structuredSnippet: '設定済み',
          phoneAsset: '050-1724-1338',
          priceAsset: '対象外'
        }
      };
    }
    if (campaignType === 'ai_bantou') {
      return {
        campaignType: 'ai_bantou',
        campaignName: 'AI帳票番頭_検索_全国_初期',
        expectedLpUrl: 'https://teruya1229.github.io/ai-chouhyou-bantou/',
        lpFixLabel: 'AI帳票番頭LP',
        expectations: {
          lp: 'https://teruya1229.github.io/ai-chouhyou-bantou/',
          bidStrategy: 'クリック数の最大化',
          budget: '1日1,000円',
          conversionGoal: 'AI帳票番頭LP_問い合わせ',
          conversionActions: ['BCサービス LP (web) ai_bantou_line_click'],
          regions: ['日本全国'],
          regionOption: '日本に現在いる、または定期的にいるユーザー',
          sitelinks: '6件以上',
          callouts: '8件以上',
          structuredSnippet: '設定済み',
          priceAsset: '4件',
          phoneAsset: '対象外'
        }
      };
    }
    return {
      campaignType: 'other',
      campaignName: '',
      expectedLpUrl: '',
      lpFixLabel: '期待するLP',
      expectations: null
    };
  }

  function normalizeCampaignLpUrl(url) {
    if (!url || typeof url !== 'string') return null;
    var trimmed = url.trim();
    if (!trimmed) return null;
    try {
      var parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      var path = parsed.pathname;
      if (path.length > 1 && path.charAt(path.length - 1) === '/') {
        path = path.slice(0, -1);
      }
      return parsed.origin + path + (parsed.search || '');
    } catch (e) {
      return null;
    }
  }

  function compareCampaignLpUrl(current, expected) {
    var normCurrent = normalizeCampaignLpUrl(current);
    var normExpected = normalizeCampaignLpUrl(expected);
    if (!normCurrent || !normExpected) return false;
    return normCurrent === normExpected;
  }

  function loadCampaignSetupChecks() {
    try {
      var raw = localStorage.getItem(CAMPAIGN_SETUP_STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveCampaignSetupChecks(checks) {
    localStorage.setItem(CAMPAIGN_SETUP_STORAGE_KEY, JSON.stringify(checks));
  }

  function getApplicableItems(campaignType) {
    var items = [];
    CAMPAIGN_SETUP_GROUPS.forEach(function (group) {
      group.items.forEach(function (item) {
        if (!item.campaigns || item.campaigns.indexOf(campaignType) !== -1) {
          items.push({ groupId: group.id, groupTitle: group.title, item: item });
        }
      });
    });
    return items;
  }

  function getDefaultItemStatuses(campaignType) {
    var statuses = {};
    var naList = CAMPAIGN_DEFAULT_NA[campaignType] || [];
    getApplicableItems(campaignType).forEach(function (entry) {
      var item = entry.item;
      if (item.auto) return;
      if (item.defaultStatus) {
        statuses[item.id] = item.defaultStatus;
      } else if (naList.indexOf(item.id) !== -1) {
        statuses[item.id] = CS_STATUS.NOT_APPLICABLE;
      } else {
        statuses[item.id] = CS_STATUS.UNCHECKED;
      }
    });
    return statuses;
  }

  function getExpectedLpUrl(campaignType) {
    if (campaignType === 'other') {
      return csOtherExpectedLp.value.trim();
    }
    return getCampaignTemplate(campaignType).expectedLpUrl;
  }

  function getCampaignDisplayName(campaignType) {
    if (campaignType === 'other') {
      var name = csOtherCampaignName.value.trim();
      return name || 'その他';
    }
    return getCampaignTemplate(campaignType).campaignName;
  }

  function computeAutoStatuses(lpUrl, expectedLpUrl) {
    var normalized = normalizeCampaignLpUrl(lpUrl);
    var entered = normalized !== null;
    var matches = entered && compareCampaignLpUrl(lpUrl, expectedLpUrl);
    var enteredStatus = entered ? CS_STATUS.OK : CS_STATUS.NG;
    var matchesStatus = matches ? CS_STATUS.OK : CS_STATUS.NG;
    if (!entered) matchesStatus = CS_STATUS.NG;
    return {
      lpUrlEntered: enteredStatus,
      lpUrlMatches: matchesStatus,
      finalUrlCorrect: matchesStatus
    };
  }

  function readManualStatusesFromDom() {
    var statuses = {};
    csCheckGroups.querySelectorAll('.ab-cs-status-select').forEach(function (sel) {
      var id = sel.getAttribute('data-item-id');
      if (id) statuses[id] = sel.value;
    });
    return statuses;
  }

  function readCampaignSetupForm() {
    var campaignType = csCampaignSelect.value;
    var template = getCampaignTemplate(campaignType);
    var lpUrl = csLpUrl.value.trim();
    var expectedLpUrl = getExpectedLpUrl(campaignType);
    var autoStatuses = computeAutoStatuses(lpUrl, expectedLpUrl);
    var manualStatuses = readManualStatusesFromDom();
    var itemStatuses = {};
    var applicable = getApplicableItems(campaignType);

    applicable.forEach(function (entry) {
      var item = entry.item;
      if (item.auto) {
        itemStatuses[item.id] = autoStatuses[item.id] || CS_STATUS.NG;
      } else {
        itemStatuses[item.id] = manualStatuses[item.id] || CS_STATUS.UNCHECKED;
      }
    });

    var progress = calculateCampaignSetupProgress(itemStatuses, campaignType);
    var overallDecision = decideCampaignSetup(progress);

    return {
      campaignType: campaignType,
      campaignName: getCampaignDisplayName(campaignType),
      lpUrl: lpUrl,
      expectedLpUrl: expectedLpUrl,
      lpUrlMatches: autoStatuses.lpUrlMatches === CS_STATUS.OK,
      itemStatuses: itemStatuses,
      memo: csMemo.value.trim(),
      okCount: progress.okCount,
      ngCount: progress.ngCount,
      uncheckedCount: progress.uncheckedCount,
      notApplicableCount: progress.notApplicableCount,
      completionRate: progress.completionRate,
      overallDecision: overallDecision
    };
  }

  function calculateCampaignSetupProgress(itemStatuses, campaignType) {
    var applicable = getApplicableItems(campaignType);
    var okCount = 0;
    var ngCount = 0;
    var uncheckedCount = 0;
    var notApplicableCount = 0;
    var totalApplicable = 0;

    applicable.forEach(function (entry) {
      var status = itemStatuses[entry.item.id] || CS_STATUS.UNCHECKED;
      if (status === CS_STATUS.NOT_APPLICABLE) {
        notApplicableCount++;
        return;
      }
      totalApplicable++;
      if (status === CS_STATUS.OK) okCount++;
      else if (status === CS_STATUS.NG) ngCount++;
      else uncheckedCount++;
    });

    var completionRate = 0;
    if (totalApplicable > 0) {
      completionRate = Math.round((okCount / totalApplicable) * 100);
    }

    return {
      okCount: okCount,
      ngCount: ngCount,
      uncheckedCount: uncheckedCount,
      notApplicableCount: notApplicableCount,
      totalApplicable: totalApplicable,
      completionRate: completionRate
    };
  }

  function decideCampaignSetup(progress) {
    if (progress.ngCount > 0) return CS_DECISION.NEEDS_FIX;
    if (progress.uncheckedCount > 0) return CS_DECISION.IN_PROGRESS;
    if (progress.totalApplicable > 0 && progress.okCount === progress.totalApplicable) {
      return CS_DECISION.COMPLETE;
    }
    return CS_DECISION.IN_PROGRESS;
  }

  function csDecisionClass(decision) {
    if (decision === CS_DECISION.COMPLETE) return 'is-cs-complete';
    if (decision === CS_DECISION.NEEDS_FIX) return 'is-cs-needs-fix';
    return 'is-cs-in-progress';
  }

  function csOverallClass(decision) {
    if (decision === CS_DECISION.COMPLETE) return 'is-complete';
    if (decision === CS_DECISION.NEEDS_FIX) return 'is-needs-fix';
    return 'is-in-progress';
  }

  function findItemLabel(itemId, campaignType) {
    var found = null;
    getApplicableItems(campaignType).forEach(function (entry) {
      if (entry.item.id === itemId) found = entry.item.label;
    });
    return found || itemId;
  }

  function getNextCampaignSetupAction(formData) {
    var campaignType = formData.campaignType;
    var template = getCampaignTemplate(campaignType);
    var auto = computeAutoStatuses(formData.lpUrl, formData.expectedLpUrl);

    if (auto.lpUrlEntered === CS_STATUS.NG || auto.lpUrlMatches === CS_STATUS.NG) {
      return {
        type: 'lpUrl',
        message: '最終ページURLを' + template.lpFixLabel + 'に修正してください。',
        correctUrl: formData.expectedLpUrl
      };
    }

    var applicable = getApplicableItems(campaignType);
    var i;
    for (i = 0; i < applicable.length; i++) {
      var item = applicable[i].item;
      if (item.auto) continue;
      var status = formData.itemStatuses[item.id];
      if (status === CS_STATUS.NG) {
        return {
          type: 'ng',
          message: '「' + item.label + '」を修正してください。'
        };
      }
    }
    for (i = 0; i < applicable.length; i++) {
      item = applicable[i].item;
      if (item.auto) continue;
      status = formData.itemStatuses[item.id];
      if (status === CS_STATUS.UNCHECKED) {
        return {
          type: 'unchecked',
          message: '「' + item.label + '」を確認してください。'
        };
      }
    }

    return {
      type: 'complete',
      message: '設定完了。配信後の数値確認へ進んでください。'
    };
  }

  function renderCampaignSetupTemplate(campaignType) {
    var template = getCampaignTemplate(campaignType);
    if (!template.expectations) {
      csTemplateCard.innerHTML = '';
      csTemplateCard.hidden = true;
      return;
    }
    csTemplateCard.hidden = false;
    var exp = template.expectations;
    csTemplateCard.innerHTML =
      '<h4>期待設定（' + escapeHtml(template.campaignName) + '）</h4>' +
      '<dl class="ab-cs-template-grid">' +
        '<dt>LP</dt><dd>' + escapeHtml(exp.lp) + '</dd>' +
        '<dt>入札戦略</dt><dd>' + escapeHtml(exp.bidStrategy) + '</dd>' +
        '<dt>予算</dt><dd>' + escapeHtml(exp.budget) + '</dd>' +
        '<dt>コンバージョン目標</dt><dd>' + escapeHtml(exp.conversionGoal) + '</dd>' +
        '<dt>コンバージョンアクション</dt><dd><ul class="ab-cs-template-list">' +
          exp.conversionActions.map(function (a) { return '<li>' + escapeHtml(a) + '</li>'; }).join('') +
        '</ul></dd>' +
        '<dt>対象地域</dt><dd><ul class="ab-cs-template-list">' +
          exp.regions.map(function (r) { return '<li>' + escapeHtml(r) + '</li>'; }).join('') +
        '</ul></dd>' +
        '<dt>地域オプション</dt><dd>' + escapeHtml(exp.regionOption) + '</dd>' +
        '<dt>サイトリンク</dt><dd>' + escapeHtml(exp.sitelinks) + '</dd>' +
        '<dt>コールアウト</dt><dd>' + escapeHtml(exp.callouts) + '</dd>' +
        '<dt>構造化スニペット</dt><dd>' + escapeHtml(exp.structuredSnippet) + '</dd>' +
        (exp.phoneAsset ? '<dt>電話アセット</dt><dd>' + escapeHtml(exp.phoneAsset) + '</dd>' : '') +
        (exp.priceAsset ? '<dt>価格アセット</dt><dd>' + escapeHtml(exp.priceAsset) + '</dd>' : '') +
      '</dl>';
  }

  function renderStatusSelect(item, value, disabled) {
    var options = ['unchecked', 'ok', 'ng', 'not_applicable'].map(function (v) {
      var selected = value === v ? ' selected' : '';
      return '<option value="' + v + '"' + selected + '>' + CS_STATUS_LABELS[v] + '</option>';
    }).join('');
    return '<select class="ab-cs-status-select is-' + value + '" data-item-id="' + escapeHtml(item.id) + '"' +
      (disabled ? ' disabled' : '') + '>' + options + '</select>';
  }

  function renderAutoStatusDisplay(status) {
    var label = status === CS_STATUS.OK ? 'OK' : (status === CS_STATUS.NG ? 'NG' : '未確認');
    return '<div class="ab-cs-auto-status is-' + status + '" data-auto-id="' + escapeHtml(status) + '">' + label + '（自動判定）</div>';
  }

  function countGroupStats(group, itemStatuses, campaignType) {
    var ng = 0;
    var unchecked = 0;
    group.items.forEach(function (item) {
      if (item.campaigns && item.campaigns.indexOf(campaignType) === -1) return;
      var status = itemStatuses[item.id];
      if (!status || status === CS_STATUS.UNCHECKED) unchecked++;
      else if (status === CS_STATUS.NG) ng++;
    });
    return { ng: ng, unchecked: unchecked };
  }

  function renderCampaignSetupForm(campaignType, itemStatuses) {
    var defaults = getDefaultItemStatuses(campaignType);
    var merged = {};
    Object.keys(defaults).forEach(function (k) { merged[k] = defaults[k]; });
    if (itemStatuses) {
      Object.keys(itemStatuses).forEach(function (k) { merged[k] = itemStatuses[k]; });
    }

    var lpUrl = csLpUrl.value.trim();
    var expectedLpUrl = getExpectedLpUrl(campaignType);
    var autoStatuses = computeAutoStatuses(lpUrl, expectedLpUrl);
    merged.lpUrlEntered = autoStatuses.lpUrlEntered;
    merged.lpUrlMatches = autoStatuses.lpUrlMatches;
    merged.finalUrlCorrect = autoStatuses.finalUrlCorrect;

    csCheckGroups.innerHTML = CAMPAIGN_SETUP_GROUPS.map(function (group) {
      var visibleItems = group.items.filter(function (item) {
        return !item.campaigns || item.campaigns.indexOf(campaignType) !== -1;
      });
      if (!visibleItems.length) return '';

      var stats = countGroupStats(group, merged, campaignType);
      var itemsHtml = visibleItems.map(function (item) {
        var status = merged[item.id] || CS_STATUS.UNCHECKED;
        var control = item.auto
          ? renderAutoStatusDisplay(status)
          : renderStatusSelect(item, status, false);
        return '<div class="ab-cs-check-item' + (item.auto ? ' is-auto' : '') + '" data-item-id="' + escapeHtml(item.id) + '">' +
          '<span class="ab-cs-check-label">' + escapeHtml(item.label) +
          (item.auto ? '<span class="ab-cs-auto-badge">自動</span>' : '') + '</span>' +
          control +
        '</div>';
      }).join('');

      return '<details class="ab-cs-check-group" data-group-id="' + escapeHtml(group.id) + '" open>' +
        '<summary>' + escapeHtml(group.title) +
        '<span class="ab-cs-group-badges">' +
          (stats.ng ? '<span class="is-ng">NG ' + stats.ng + '件</span>' : '') +
          (stats.unchecked ? '<span class="is-unchecked">／未確認 ' + stats.unchecked + '件</span>' : '') +
        '</span></summary>' +
        '<div class="ab-cs-check-items">' + itemsHtml + '</div>' +
      '</details>';
    }).join('');

    renderLpCompare(lpUrl, expectedLpUrl, autoStatuses);
  }

  function renderLpCompare(lpUrl, expectedLpUrl, autoStatuses) {
    var matchText = autoStatuses.lpUrlMatches === CS_STATUS.OK ? '一致' : '不一致';
    var matchCls = autoStatuses.lpUrlMatches === CS_STATUS.OK ? 'is-ok' : 'is-ng';
    csLpCompare.innerHTML =
      '<div>期待するLP URL：<span>' + escapeHtml(expectedLpUrl || '—') + '</span></div>' +
      '<div>URL一致判定：<span class="' + matchCls + '">' + matchText + '</span></div>';
  }

  function renderCampaignSetupProgress(formData) {
    var p = calculateCampaignSetupProgress(formData.itemStatuses, formData.campaignType);
    csProgressStats.innerHTML =
      '<span class="ab-cs-stat is-ok">OK ' + p.okCount + '件</span>' +
      '<span class="ab-cs-stat is-ng">NG ' + p.ngCount + '件</span>' +
      '<span class="ab-cs-stat is-unchecked">未確認 ' + p.uncheckedCount + '件</span>' +
      '<span class="ab-cs-stat is-na">対象外 ' + p.notApplicableCount + '件</span>';

    csOverallBox.className = 'ab-cs-overall ' + csOverallClass(formData.overallDecision);
    csOverallBox.innerHTML =
      '<div class="ab-cs-overall-label">総合判定：' + escapeHtml(formData.overallDecision) + '</div>' +
      '<div class="ab-cs-completion">完了率：' + p.completionRate + '%（' + p.okCount + ' / ' + p.totalApplicable + '）</div>';

    var next = getNextCampaignSetupAction(formData);
    var nextHtml = '<strong>次の一手：</strong>' + escapeHtml(next.message);
    if (next.correctUrl) {
      nextHtml += '<span class="ab-cs-correct-url">正しいURL：<br>' + escapeHtml(next.correctUrl) + '</span>';
    }
    csNextActionBox.innerHTML = nextHtml;
  }

  function getLatestCheckForCampaign(checks, campaignType, campaignName) {
    var filtered = checks.filter(function (c) {
      if (campaignType === 'other') {
        return c.campaignType === 'other' && c.campaignName === campaignName;
      }
      return c.campaignType === campaignType;
    });
    filtered.sort(function (a, b) {
      return (a.checkedAt || '') < (b.checkedAt || '') ? 1 : (a.checkedAt || '') > (b.checkedAt || '') ? -1 : 0;
    });
    return filtered.length ? filtered[0] : null;
  }

  function listNgAndUnchecked(record) {
    var campaignType = record.campaignType || 'complete_disassembly';
    var statuses = record.itemStatuses || {};
    var ng = [];
    var unchecked = [];
    getApplicableItems(campaignType).forEach(function (entry) {
      var status = statuses[entry.item.id];
      if (status === CS_STATUS.NG) ng.push(entry.item.label);
      else if (status === CS_STATUS.UNCHECKED) unchecked.push(entry.item.label);
    });
    return { ng: ng, unchecked: unchecked };
  }

  function renderCampaignSetupLatest(checks, campaignType) {
    var campaignName = getCampaignDisplayName(campaignType);
    var latest = getLatestCheckForCampaign(checks, campaignType, campaignName);

    if (!latest) {
      csLatest.hidden = false;
      csLatestBody.innerHTML = '<p>まだ初期設定チェックの履歴がありません。</p>';
      return;
    }

    var lists = listNgAndUnchecked(latest);
    var lpMatchText = latest.lpUrlMatches ? '一致' : '不一致';
    var lpMatchCls = latest.lpUrlMatches ? 'is-ok' : 'is-ng';

    csLatest.hidden = false;
    csLatestBody.innerHTML =
      '<div class="ab-cs-latest-summary">' +
        '<span><strong>最終確認日：</strong>' + escapeHtml(latest.checkedAt || '—') + '</span>' +
        '<span class="ab-badge ' + csDecisionClass(latest.overallDecision) + '">' + escapeHtml(latest.overallDecision || '—') + '</span>' +
        '<span>完了率：' + (latest.completionRate != null ? latest.completionRate : 0) + '%</span>' +
      '</div>' +
      '<p><strong>現在のLP URL：</strong>' + escapeHtml(latest.lpUrl || '—') + '</p>' +
      '<p><strong>期待するLP URL：</strong>' + escapeHtml(latest.expectedLpUrl || '—') + '</p>' +
      '<p><strong>LP URL一致判定：</strong><span class="' + lpMatchCls + '">' + lpMatchText + '</span></p>' +
      (lists.ng.length ? '<p><strong>NG項目：</strong>' + escapeHtml(lists.ng.join('、')) + '</p>' : '<p><strong>NG項目：</strong>なし</p>') +
      (lists.unchecked.length ? '<p><strong>未確認項目：</strong>' + escapeHtml(lists.unchecked.join('、')) + '</p>' : '<p><strong>未確認項目：</strong>なし</p>') +
      (latest.memo ? '<p><strong>メモ：</strong>' + escapeHtml(latest.memo) + '</p>' : '');
  }

  function renderCampaignSetupHistory(checks) {
    var sorted = checks.slice().sort(function (a, b) {
      return (a.checkedAt || '') < (b.checkedAt || '') ? 1 : (a.checkedAt || '') > (b.checkedAt || '') ? -1 : 0;
    });

    csHistoryTbody.innerHTML = sorted.map(function (e) {
      var lpMatch = e.lpUrlMatches ? '一致' : '不一致';
      return '<tr>' +
        '<td>' + escapeHtml(e.checkedAt || '—') + '</td>' +
        '<td>' + escapeHtml(e.campaignName || '—') + '</td>' +
        '<td style="text-align:center;"><span class="ab-badge ' + csDecisionClass(e.overallDecision) + '">' + escapeHtml(e.overallDecision || '—') + '</span></td>' +
        '<td>' + (e.completionRate != null ? e.completionRate : 0) + '%</td>' +
        '<td>' + lpMatch + '</td>' +
        '<td>' + (e.okCount != null ? e.okCount : '—') + '</td>' +
        '<td>' + (e.ngCount != null ? e.ngCount : '—') + '</td>' +
        '<td>' + (e.uncheckedCount != null ? e.uncheckedCount : '—') + '</td>' +
        '<td class="memo-cell" title="' + escapeHtml(e.memo) + '">' + escapeHtml(e.memo || '—') + '</td>' +
        '<td style="text-align:center;"><button type="button" class="ab-delete-btn ab-cs-delete-btn" data-id="' + escapeHtml(e.id) + '">削除</button></td>' +
        '</tr>';
    }).join('');

    csHistoryCards.innerHTML = sorted.map(function (e) {
      var lpMatch = e.lpUrlMatches ? '一致' : '不一致';
      return '<div class="ab-cs-history-card">' +
        '<div class="ab-cs-history-card-header">' +
          '<strong>' + escapeHtml(e.checkedAt || '—') + '</strong>' +
          '<span class="ab-badge ' + csDecisionClass(e.overallDecision) + '">' + escapeHtml(e.overallDecision || '—') + '</span>' +
        '</div>' +
        '<div class="ab-cs-history-card-row">キャンペーン：' + escapeHtml(e.campaignName || '—') + '</div>' +
        '<div class="ab-cs-history-card-row">完了率：' + (e.completionRate != null ? e.completionRate : 0) + '%｜LP URL：' + lpMatch + '</div>' +
        '<div class="ab-cs-history-card-row">OK ' + (e.okCount != null ? e.okCount : 0) + '／NG ' + (e.ngCount != null ? e.ngCount : 0) + '／未確認 ' + (e.uncheckedCount != null ? e.uncheckedCount : 0) + '</div>' +
        (e.memo ? '<div class="ab-cs-history-card-row">メモ：' + escapeHtml(e.memo) + '</div>' : '') +
        '<button type="button" class="ab-delete-btn ab-cs-delete-btn" data-id="' + escapeHtml(e.id) + '" style="margin-top:8px;">削除</button>' +
      '</div>';
    }).join('');

    csHistoryEmpty.style.display = sorted.length ? 'none' : 'block';
  }

  function updateCampaignSetupPreview() {
    var formData = readCampaignSetupForm();
    renderCampaignSetupProgress(formData);
    var campaignType = csCampaignSelect.value;
    var autoStatuses = computeAutoStatuses(formData.lpUrl, formData.expectedLpUrl);
    var manualStatuses = readManualStatusesFromDom();
    var merged = getDefaultItemStatuses(campaignType);
    Object.keys(manualStatuses).forEach(function (k) { merged[k] = manualStatuses[k]; });
    merged.lpUrlEntered = autoStatuses.lpUrlEntered;
    merged.lpUrlMatches = autoStatuses.lpUrlMatches;
    merged.finalUrlCorrect = autoStatuses.finalUrlCorrect;

    csCheckGroups.querySelectorAll('.ab-cs-check-item.is-auto').forEach(function (el) {
      var itemId = el.getAttribute('data-item-id');
      var status = merged[itemId] || CS_STATUS.UNCHECKED;
      var display = el.querySelector('.ab-cs-auto-status');
      if (display) {
        var label = status === CS_STATUS.OK ? 'OK' : (status === CS_STATUS.NG ? 'NG' : '未確認');
        display.className = 'ab-cs-auto-status is-' + status;
        display.textContent = label + '（自動判定）';
      }
    });

    renderLpCompare(formData.lpUrl, formData.expectedLpUrl, autoStatuses);

    CAMPAIGN_SETUP_GROUPS.forEach(function (group) {
      var details = csCheckGroups.querySelector('.ab-cs-check-group[data-group-id="' + group.id + '"]');
      if (!details) return;
      var stats = countGroupStats(group, merged, campaignType);
      var badges = details.querySelector('.ab-cs-group-badges');
      if (badges) {
        badges.innerHTML =
          (stats.ng ? '<span class="is-ng">NG ' + stats.ng + '件</span>' : '') +
          (stats.unchecked ? '<span class="is-unchecked">／未確認 ' + stats.unchecked + '件</span>' : '');
      }
    });
  }

  function renderCampaignSetupAll() {
    var campaignType = csCampaignSelect.value;
    csOtherFields.hidden = campaignType !== 'other';
    renderCampaignSetupTemplate(campaignType);

    var checks = loadCampaignSetupChecks();
    renderCampaignSetupLatest(checks, campaignType);
    renderCampaignSetupHistory(checks);

    var manualStatuses = readManualStatusesFromDom();
    var hasExisting = Object.keys(manualStatuses).length > 0;
    if (!hasExisting) {
      renderCampaignSetupForm(campaignType, getDefaultItemStatuses(campaignType));
    } else {
      renderCampaignSetupForm(campaignType, manualStatuses);
    }
    updateCampaignSetupPreview();
    csFormDirty = false;
  }

  function switchCampaignSetup(campaignType) {
    csCurrentCampaignType = campaignType;
    csCampaignSelect.value = campaignType;
    csOtherFields.hidden = campaignType !== 'other';
    renderCampaignSetupTemplate(campaignType);
    renderCampaignSetupForm(campaignType, getDefaultItemStatuses(campaignType));
    csLpUrl.value = '';
    csMemo.value = '';
    var checks = loadCampaignSetupChecks();
    renderCampaignSetupLatest(checks, campaignType);
    updateCampaignSetupPreview();
    csFormDirty = false;
  }

  function resetCampaignSetupForm() {
    var campaignType = csCampaignSelect.value;
    csLpUrl.value = '';
    csMemo.value = '';
    if (campaignType === 'other') {
      csOtherCampaignName.value = '';
      csOtherExpectedLp.value = '';
    }
    renderCampaignSetupForm(campaignType, getDefaultItemStatuses(campaignType));
    updateCampaignSetupPreview();
    csFormDirty = false;
  }

  function loadLatestCampaignSetupToForm() {
    var campaignType = csCampaignSelect.value;
    var campaignName = getCampaignDisplayName(campaignType);
    var checks = loadCampaignSetupChecks();
    var latest = getLatestCheckForCampaign(checks, campaignType, campaignName);

    if (!latest) {
      alert('このキャンペーンの保存履歴がありません。');
      return;
    }

    if (latest.campaignType === 'other') {
      csOtherCampaignName.value = latest.campaignName || '';
      csOtherExpectedLp.value = latest.expectedLpUrl || '';
    }
    csLpUrl.value = latest.lpUrl || '';
    csMemo.value = latest.memo || '';
    renderCampaignSetupForm(campaignType, latest.itemStatuses || getDefaultItemStatuses(campaignType));
    updateCampaignSetupPreview();
    csFormDirty = false;
  }

  function hasCampaignSetupFormChanges() {
    if (!csFormDirty) return false;
    var campaignType = csCampaignSelect.value;
    var defaults = getDefaultItemStatuses(campaignType);
    var manual = readManualStatusesFromDom();
    var hasManualChange = Object.keys(manual).some(function (k) {
      return manual[k] !== (defaults[k] || CS_STATUS.UNCHECKED);
    });
    return hasManualChange || csLpUrl.value.trim() !== '' || csMemo.value.trim() !== '';
  }

  csCampaignSelect.addEventListener('change', function () {
    var newType = csCampaignSelect.value;
    if (newType === csCurrentCampaignType) return;
    if (hasCampaignSetupFormChanges()) {
      if (!confirm('未保存の入力があります。キャンペーンを切り替えますか？')) {
        csCampaignSelect.value = csCurrentCampaignType;
        return;
      }
    }
    switchCampaignSetup(newType);
  });

  csLpUrl.addEventListener('input', function () {
    csFormDirty = true;
    updateCampaignSetupPreview();
  });

  csOtherExpectedLp.addEventListener('input', function () {
    csFormDirty = true;
    updateCampaignSetupPreview();
  });

  csCheckGroups.addEventListener('change', function (ev) {
    var sel = ev.target.closest('.ab-cs-status-select');
    if (!sel) return;
    csFormDirty = true;
    sel.className = 'ab-cs-status-select is-' + sel.value;
    updateCampaignSetupPreview();
  });

  csMemo.addEventListener('input', function () { csFormDirty = true; });

  campaignSetupForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var formData = readCampaignSetupForm();
    if (formData.campaignType === 'other' && !formData.campaignName) {
      alert('その他を選択した場合はキャンペーン名を入力してください。');
      return;
    }

    var today = new Date();
    var checkedAt = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    var record = {
      id: 'cs-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      checkedAt: checkedAt,
      campaignName: formData.campaignName,
      campaignType: formData.campaignType,
      lpUrl: formData.lpUrl,
      expectedLpUrl: formData.expectedLpUrl,
      lpUrlMatches: formData.lpUrlMatches,
      itemStatuses: formData.itemStatuses,
      memo: formData.memo,
      okCount: formData.okCount,
      ngCount: formData.ngCount,
      uncheckedCount: formData.uncheckedCount,
      notApplicableCount: formData.notApplicableCount,
      completionRate: formData.completionRate,
      overallDecision: formData.overallDecision
    };

    var checks = loadCampaignSetupChecks();
    checks.push(record);
    saveCampaignSetupChecks(checks);
    renderCampaignSetupLatest(checks, formData.campaignType);
    renderCampaignSetupHistory(checks);
    csFormDirty = false;
    alert('設定チェックを保存しました。');
  });

  csResetBtn.addEventListener('click', function () {
    if (!confirm('すべて未確認に戻しますか？キャンペーン固有の対象外項目は対象外に戻ります。')) return;
    resetCampaignSetupForm();
  });

  csLoadLatestBtn.addEventListener('click', loadLatestCampaignSetupToForm);

  function handleCsHistoryDelete(ev) {
    var btn = ev.target.closest('.ab-cs-delete-btn');
    if (!btn) return;
    if (!confirm('この設定チェック履歴を削除しますか？')) return;
    var id = btn.getAttribute('data-id');
    var checks = loadCampaignSetupChecks().filter(function (e) { return e.id !== id; });
    saveCampaignSetupChecks(checks);
    renderCampaignSetupHistory(checks);
    renderCampaignSetupLatest(checks, csCampaignSelect.value);
  }

  csHistoryTbody.addEventListener('click', handleCsHistoryDelete);
  csHistoryCards.addEventListener('click', handleCsHistoryDelete);

  /* ===== 初期化 ===== */

  (function init() {
    // 日付の初期値は昨日（Claude in Chrome の運用は「昨日のデータ」を入力するため）
    var d = new Date();
    d.setDate(d.getDate() - 1);
    var iso = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    document.getElementById('f-date').value = iso;

    var today = new Date();
    var todayIso = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    document.getElementById('pf-date').value = todayIso;

    renderAll();
    renderPreflightAll();
    renderCampaignSetupAll();
  })();
})();
