/* BCサービス / 洗濯機3問診断
 * 表示する割合は暫定の対応優先度であり、故障確率や診断結果を保証しません。
 * 既存の washing.js (LINE/電話計測) と GA4 測定IDは変更しません。
 */
(function () {
  'use strict';
  var form = document.getElementById('washer-diagnosis-form');
  var result = document.getElementById('washer-diagnosis-result');
  if (!form || !result) return;

  var ageOrder = ["under1","1to4","5to6","7to8","9plus"];
  var scoreRules = {"flakes":[[20,75,5],[85,10,5],[75,15,10],[55,20,25],[45,15,40]],"odor":[[20,75,5],[80,15,5],[70,20,10],[55,20,25],[45,15,40]],"drying":[[20,75,5],[60,35,5],[55,30,15],[40,35,25],[25,30,45]],"maintenance":[[20,75,5],[70,25,5],[65,25,10],[50,20,30],[45,20,35]],"error":[[0,90,10],[0,90,10],[0,80,20],[0,60,40],[0,45,55]],"spin":[[0,90,10],[0,85,15],[0,80,20],[0,60,40],[0,45,55]],"vibration":[[0,95,5],[0,90,10],[0,85,15],[0,75,25],[0,60,40]],"leak":[[0,95,5],[0,95,5],[0,90,10],[0,80,20],[0,65,35]]};
  var started = false;
  var resultShown = false;
  var lpViewed = false;
  var params = new URLSearchParams(window.location.search);
  var debug = params.get('debug') === '1' || params.get('debug_mode') === 'true';
  var utmSource = (params.get('utm_source') || '').toLowerCase();
  var utmMedium = (params.get('utm_medium') || '').toLowerCase();
  var referringHost = '';
  try { referringHost = new URL(document.referrer).hostname.toLowerCase(); } catch (_) {}
  var igSource = /(^|[_\\-.])(instagram|insta|ig)([_\\-.]|$)/.test(utmSource);
  var igRef = /(^|\\.)instagram\\.com$/.test(referringHost);
  var paid = /(^|[_\\-.])(paid|cpc|ppc|ads|ad)([_\\-.]|$)/.test(utmMedium);
  var trafficHint = igSource && paid ? 'instagram_paid' :
    (igSource || igRef ? 'instagram_unconfirmed' : 'other_or_unknown');

  function event(name, props) {
    if (typeof window.gtag !== 'function') return;
    var common = {
      page_type: 'washing_machine_cleaning',
      page_slug: '/washing-machine-cleaning/',
      traffic_hint: trafficHint,
      debug_flag: debug,
      transport_type: 'beacon'
    };
    if (debug) common.debug_mode = true;
    Object.keys(props || {}).forEach(function (key) { common[key] = props[key]; });
    window.gtag('event', name, common);
  }
  function selected(name) {
    var el = form.elements.namedItem(name);
    return el && typeof el.value === 'string' ? el.value : '';
  }
  function text(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }
  function scores(type, age, symptom) {
    var ageIndex = ageOrder.indexOf(age);
    var record = scoreRules[symptom];
    if ((type !== 'top' && type !== 'drum') || ageIndex < 0 || !record) return null;
    var values = record[ageIndex].slice();
    if (symptom === 'drying' && type === 'top' && age !== 'under1') {
      var adjustment = Math.min(10, values[0]);
      values[0] -= adjustment;
      values[1] += adjustment;
    }
    return values;
  }
  function recommendation(age, symptom, values) {
    if (symptom === 'leak') return [
      'まず使用を止めて、水漏れの確認を',
      '周囲が濡れているときは無理に電気部分に触れず、可能なら水栓を閉めてください。洗浄より先に原因を確認します。'
    ];
    if (symptom === 'vibration') return [
      '異常な振動は、清掃前に点検を',
      '設置状態・偏り・部品の不具合など、原因の確認を優先します。異常な運転は続けないでください。'
    ];
    if (symptom === 'error' || symptom === 'spin') return [
      '動作不良は、清掃より点検・保証の確認を',
      'エラー停止や脱水不能は、汚れが原因とは限りません。状況を確認し、修理費と買い替えを検討します。'
    ];
    if (age === 'under1') return [
      'まず保証と症状を確認しましょう',
      '購入間もない機種は、保証の条件や故障の可能性を確認してから清掃を検討します。'
    ];
    if (values[2] > values[0] && values[2] > values[1]) return [
      '清掃だけでなく、買い替えとの比較も',
      '年数と症状を考えると、修理・清掃にかける費用と新品への交換を比較する段階です。'
    ];
    if (values[1] > values[0]) return [
      '清掃前に、故障の可能性を確認',
      '分解洗浄で直せる不調と、部品の点検が必要な不調を切り分けます。'
    ];
    if (symptom === 'drying') return [
      '乾燥経路のホコリ詰まりなどを確認',
      'ドラム式の乾燥不良は汚れが関係することもありますが、部品故障の場合は清掃だけでは改善しません。'
    ];
    return [
      'まず汚れの状況を確認しましょう',
      '黒いカスやニオイなどは、クリーニングで改善する場合があります。機種・年数・設置状況を確認してご案内します。'
    ];
  }
  function render(type, age, symptom, values) {
    var message = recommendation(age, symptom, values);
    var labels = ['清掃', '修理・点検', '買い替え'];
    var ids = ['clean', 'inspect', 'replace'];
    text('washer-diagnosis-headline', message[0]);
    text('washer-diagnosis-explanation', message[1]);
    ids.forEach(function (id, index) {
      text('washer-diagnosis-percent-' + id, values[index] + '%');
      var bar = document.getElementById('washer-diagnosis-bar-' + id);
      if (bar) {
        bar.style.width = values[index] + '%';
        bar.setAttribute('aria-valuenow', String(values[index]));
        bar.setAttribute('aria-label', labels[index] + 'の対応優先度 ' + values[index] + '%');
      }
    });
    var ageNote = age === 'under1' ? '保証内容を確認してから進めましょう。' :
      age === '5to6' ? '部品の劣化や故障リスクも確認します。' :
      age === '7to8' ? '清掃と買い替えの費用を比べましょう。' :
      age === '9plus' ? '故障が疑われる場合は買い替えも強く検討します。' : 'まずは汚れ・症状の確認から進めます。';
    text('washer-diagnosis-age-note', ageNote);
    result.hidden = false;
    resultShown = true;
    event('diagnosis_result_view', {
      washer_type: type, usage_age_band: age, symptom_category: symptom,
      priority_cleaning: values[0], priority_inspection: values[1],
      priority_replacement: values[2]
    });
    result.scrollIntoView({ behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    result.focus({ preventScroll: true });
  }
  var typeInputs = form.querySelectorAll('input[name="washer_type"]');
  typeInputs.forEach(function (input) {
    input.addEventListener('change', function () {
      if (!started && input.checked) {
        started = true;
        event('diagnosis_start', { washer_type: input.value });
      }
    });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    event('diagnosis_submit', { diagnosis_completed: !!(selected('washer_type') && selected('usage_age') && selected('symptom')) });
    var type = selected('washer_type');
    var age = selected('usage_age');
    var symptom = selected('symptom');
    var values = scores(type, age, symptom);
    var warning = document.getElementById('washer-diagnosis-error');
    if (!values) {
      if (warning) { warning.textContent = '3つの質問すべてに回答してください。'; warning.hidden = false; }
      var missing = !type ? form.querySelector('input[name="washer_type"]') :
        !age ? form.querySelector('[name="usage_age"]') : form.querySelector('[name="symptom"]');
      if (missing) missing.focus();
      return;
    }
    if (warning) warning.hidden = true;
    render(type, age, symptom, values);
  });
  // 結果後にサービスの説明を実際に見たときだけ1回送信。スクロール前には送らない。
  var target = document.getElementById('concerns');
  if (target && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (!resultShown || lpViewed || !entries.some(function (entry) { return entry.isIntersecting; })) return;
      lpViewed = true;
      event('diagnosis_lp_view', { lp_section: 'concerns' });
      observer.disconnect();
    }, { threshold: 0.25 });
    observer.observe(target);
  } else if (target) {
    function checkView() {
      if (!resultShown || lpViewed) return;
      var box = target.getBoundingClientRect();
      if (box.top < window.innerHeight * 0.75 && box.bottom > window.innerHeight * 0.25) {
        lpViewed = true; event('diagnosis_lp_view', { lp_section: 'concerns' });
        window.removeEventListener('scroll', checkView);
      }
    }
    window.addEventListener('scroll', checkView, { passive: true });
  }
})();
