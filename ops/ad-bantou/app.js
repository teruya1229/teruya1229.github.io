/* 広告番頭 MVP
 * 保存先: localStorage（キーは広告番頭専用）
 * 将来 Google Sheets / Airtable / Supabase / API 連携へ移行しやすいよう、
 * データはシンプルな JSON 配列で保持する。
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'bcAdBantouDailyLogs';

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

  /* ===== 初期化 ===== */

  (function init() {
    // 日付の初期値は昨日（Claude in Chrome の運用は「昨日のデータ」を入力するため）
    var d = new Date();
    d.setDate(d.getDate() - 1);
    var iso = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    document.getElementById('f-date').value = iso;

    renderAll();
  })();
})();
