/* BC aircon triage v0.4: provisional rules, NOT calibrated probabilities.
 * No inputs leave this page automatically. No analytics or storage is added.
 * Safety guidance follows the results; the form does not collect safety answers.
 * Explicit safety flags remain supported for direct calculate() callers. */
(function () {
  'use strict';
  var VERSION = '0.4';
  var KEYS = ['replace', 'repair', 'clean'];
  var LABELS = {replace: '買い替え', repair: '修理・点検', clean: 'クリーニング'};
  var TABLES = {
    age: {new: [-6,10,5], mid: [0,10,5], old: [15,0,0], very_old: [25,-4,-3], unknown: [0,0,0]},
    symptom: {smell: [-4,-5,55], dirt: [-6,-8,60], air: [-4,17,55], poor: [-7,28,46], stop: [15,65,-10], leak: [-7,28,46], noise: [9,65,-10], none: [0,-8,5], maintenance: [0,-8,20]},
    performance: {normal: [-2,-5,10], weak: [5,15,5], none: [10,40,-15], unknown: [0,0,0]},
    filter: {dirty: [0,0,12], clean: [0,0,-2], unknown: [0,0,0]},
    wash: {recent: [0,0,-10], some: [0,0,4], old: [0,0,10], never: [0,0,14], unknown: [0,0,0]},
    quote: {none: [0,0,0], under: [-8,30,0], medium: [3,16,0], high: [20,4,0], very_high: [40,-5,0], unavailable: [80,-15,-20]}
  };
  var SYMPTOM_REASON = {
    smell: 'ニオイが主な悩みのため、汚れの確認を重視しました。焦げ臭さは別扱いです。',
    dirt: '内部の目に見える汚れを、清掃を検討する材料にしました。',
    air: 'フィルターや内部の汚れを確認し、まず清掃を検討します。改善しなければ修理・点検が必要です。',
    poor: '汚れが原因なら清掃で改善する場合があります。冷媒や機械の不具合は修理・点検が必要です。',
    stop: 'エラー・途中停止があるため、清掃を頼む前に原因確認を優先します。',
    leak: '排水の詰まりなら清掃で改善する場合があります。水漏れ中は運転を止め、原因を確認してから作業を判断します。',
    noise: '異音・異常振動があるため、使用を止めて点検を優先します。',
    none: '気になるという情報だけでは、有料の作業が必要とは判断しません。',
    maintenance: '定期清掃の希望を反映しました。使用年数だけで交換を勧めるものではありません。'
  };
  function own(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function percentages(scores) {
    var weights = scores.map(function (n) { return Math.max(5, n); });
    var sum = weights.reduce(function (a, b) { return a + b; }, 0);
    var raw = weights.map(function (n) { return n * 100 / sum; });
    var rounded = raw.map(Math.floor);
    var remainder = 100 - rounded.reduce(function (a, b) { return a + b; }, 0);
    var order = [0,1,2].sort(function (a, b) { return (raw[b]-rounded[b])-(raw[a]-rounded[a]) || a-b; });
    for (var i = 0; i < remainder; i++) rounded[order[i]]++;
    return {replace: rounded[0], repair: rounded[1], clean: rounded[2]};
  }
  function calculate(input) {
    if (!input || typeof input !== 'object') return null;
    if (input.danger === 'yes' || input.danger === true) return {
      status: 'stop', pcts: null, leading: null,
      heading: '使用を中止して、安全点検を',
      advice: '焦げ臭さ・プラグの異常な発熱・ブレーカーの反復作動がある場合は、運転を中止し、販売店・メーカーなどへ点検を相談してください。',
      reasons: ['安全に関わる症状のため、買い替え・修理・清掃の割合は表示しません。', '再運転・ブレーカーの繰り返し投入・自己分解はせず、点検を優先してください。'],
      next: '危険な箇所に触れず、販売店・メーカー等へ連絡。発煙・火災時は安全な場所へ避難し119番。'
    };
    if (input.danger === 'unknown') return {
      status: 'hold', pcts: null, leading: null,
      heading: 'まずは安全に関わる症状を確認',
      advice: '焦げ臭さ・プラグの異常発熱・ブレーカーの反復作動がないか、安全に分かる範囲で確認してください。',
      reasons: ['安全状態が不明なため、割合による判定は保留しています。', '確認のために危険な部分へ触れたり、分解したりする必要はありません。'],
      next: '異常が疑われる場合は運転を止めて点検を相談してください。'
    };
    if (!own(TABLES.age, input.age) || !own(TABLES.symptom, input.symptom)) return null;
    var v = {age: input.age, symptom: input.symptom};
    ['performance','filter','wash','quote'].forEach(function (k) {
      v[k] = own(TABLES[k], input[k]) ? input[k] : (k === 'quote' ? 'none' : 'unknown');
    });
    var score = [15,15,15];
    Object.keys(TABLES).forEach(function (k) {
      TABLES[k][v[k]].forEach(function (n, i) { score[i] += n; });
    });
    var abnormal = ['poor','stop','leak','noise'].indexOf(v.symptom) !== -1 || v.performance === 'none';
    var quoted = v.quote !== 'none';
    var cleaningComparison = ['poor','leak'].indexOf(v.symptom) !== -1 && !quoted;
    var old = v.age === 'old' || v.age === 'very_old';
    var costly = v.quote === 'high' || v.quote === 'very_high';
    var caution = v.symptom === 'leak' || v.symptom === 'noise';
    var reasons = [SYMPTOM_REASON[v.symptom]];
    if (v.performance === 'none') reasons.push('ほとんど効かないため、汚れの有無にかかわらず故障等の点検を先に行う想定です。');
    if (old && (abnormal || quoted)) {
      reasons.push('長く使用しているため、修理費・部品供給・今後使う期間を比較する想定です。年数だけで修理不可とは判断しません。');
      if (costly) score[0] += v.age === 'very_old' ? 60 : 45;
    }
    if (v.age === 'new' && (abnormal || quoted)) reasons.push('比較的新しいため、買い替え前に保証・延長保証の対象かも確認してください。');
    if (costly) reasons.push('入力された修理見積もりが高めのため、新品の総額との比較を重視しました。');
    if (v.quote === 'under' || v.quote === 'medium') reasons.push('入力された修理見積もりを、修理を検討する材料にしました。見積範囲・追加費・保証は別途確認が必要です。');
    if (v.filter === 'dirty') reasons.push('フィルター汚れは、まず取扱説明書に沿ったお手入れで改善する場合もあります。有料の内部洗浄が必須という意味ではありません。');
    if (v.wash === 'old' || v.wash === 'never') reasons.push('洗浄履歴も補助材料にしています。年数だけで清掃の必要性は確定しません。');
    if (['stop','noise'].indexOf(v.symptom) !== -1 || (v.performance === 'none' && !cleaningComparison)) score[2] = Math.min(score[2], 7);
    else if (quoted) score[2] = Math.min(score[2], 20);
    // Business review: compare cleaning and repair before a confirmed fault or quotation.
    // These are consultation priorities, not measured fault or cleaning-success probabilities.
    if (cleaningComparison && v.performance === 'none') {
      score[1] -= 35;
      score[2] += 28;
    }
    if (!abnormal && !quoted && (v.symptom === 'none' || v.symptom === 'maintenance')) score[0] = Math.min(score[0], 10);
    var pcts = percentages(score);
    if (v.quote === 'unavailable') {
      pcts = {replace:90, repair:5, clean:5};
      reasons.unshift('「部品なし・修理不可」との回答を優先しました。正確な型番と、メーカー等の確認結果かを再確認してください。');
    }
    var sorted = KEYS.slice().sort(function (a, b) { return pcts[b] - pcts[a]; });
    var leader = sorted[0];
    var nearTie = pcts[sorted[0]] - pcts[sorted[1]] < 8;
    var noProblem = !abnormal && !quoted && v.symptom === 'none' && v.performance !== 'weak';
    var heading = nearTie ? LABELS[sorted[0]] + 'と' + LABELS[sorted[1]] + 'を比較' : LABELS[leader] + 'を検討';
    var advice = {
      replace: '修理費と新品の総額を比べてみましょう。',
      repair: '原因と修理費を確認してから判断しましょう。',
      clean: '汚れの状態に合ったお掃除を検討しましょう。'
    }[leader];
    if (nearTie) advice = '型番や写真を確認して判断します。';
    if (noProblem) { heading = '今すぐ作業が必要とは限りません'; advice = '不具合がなければ、普段のお手入れで十分な場合もあります。'; }
    if (v.symptom === 'air' && !quoted && v.performance !== 'none' && leader === 'clean') {
      heading = 'まずはクリーニングを検討';
      advice = '汚れを確認してクリーニング。改善しなければ修理・点検へ。';
    }
    if (v.symptom === 'poor' && cleaningComparison) {
      heading = 'クリーニングと修理を比較';
      advice = v.performance === 'none' ? 'ほとんど効かない場合は原因確認が先。汚れなら清掃、故障なら修理へ。' : '汚れが原因ならクリーニング。改善しなければ修理・点検へ。';
    }
    if (v.symptom === 'leak' && cleaningComparison) {
      heading = 'クリーニングと修理を比較';
      advice = '排水の詰まりなら清掃。改善しなければ修理・点検へ。';
    }
    if (v.symptom === 'noise' || (v.symptom === 'leak' && quoted)) { heading = 'まずは点検をご相談ください'; advice = '原因を確認してから、修理・買い替えを判断します。'; }
    if (v.age === 'unknown' || v.performance === 'unknown') reasons.push('年数または効き具合が不明なため、結果は特に暫定的です。型番ラベルと状況を確認してください。');
    return {
      status: caution ? 'caution' : 'ok', pcts: pcts, leading: leader,
      heading: heading, advice: advice, reasons: reasons,
      next: abnormal || quoted ? '型番・エラー表示・状況の写真を添えて相談。保証がある場合は契約窓口も確認。' : '型番ラベルと汚れの写真を添えて相談。内部の自己分解・洗浄はしないでください。'
    };
  }
  function init() {
    var root = document.getElementById('bc-diagnosis');
    if (!root) return;
    var form = document.getElementById('bc-form');
    var names = ['age','symptom','performance','filter','wash','quote'];
    var fields = {};
    names.forEach(function (k) { fields[k] = document.getElementById('q-' + k); });
    if (names.some(function (k) { return !fields[k]; })) return;
    var panel = document.getElementById('bc-result-panel');
    var title = document.getElementById('bc-result-title');
    var advice = document.getElementById('bc-advice');
    var notes = document.getElementById('bc-notes');
    var warning = document.getElementById('bc-warning');
    var bars = document.getElementById('bc-bars');
    var status = document.getElementById('bc-copy-status');
    var manual = document.getElementById('bc-manual');
    var latest = null;
    var copyVersion = 0;
    var submitted = false;
    function values() { var v = {}; names.forEach(function (k) { v[k] = fields[k].value; }); return v; }
    function update() {
      copyVersion++;
      latest = submitted ? calculate(values()) : null;
      status.textContent = '';
      manual.hidden = true;
      manual.value = '';
      panel.hidden = !latest;
      if (!latest) return;
      title.textContent = latest.heading;
      advice.textContent = latest.advice;
      warning.hidden = latest.status !== 'caution';
      warning.textContent = latest.status === 'caution' ? (fields.symptom.value === 'leak' ? '水漏れ中は運転を止めてください。電気部分が濡れている場合は点検を優先してください。' : '異常な音がする場合は、使用を止めて点検をご相談ください。') : '';
      bars.hidden = !latest.pcts;
      KEYS.forEach(function (k) {
        var n = latest.pcts ? latest.pcts[k] : 0;
        document.getElementById('bc-pct-' + k).textContent = latest.pcts ? n + '%' : '—';
        document.getElementById('bc-fill-' + k).style.width = n + '%';
        document.getElementById('bc-bar-' + k).setAttribute('aria-valuenow', String(n));
      });
      while (notes.firstChild) notes.removeChild(notes.firstChild);
      latest.reasons.forEach(function (reason) { var li = document.createElement('li'); li.textContent = reason; notes.appendChild(li); });
    }
    function summary() {
      if (!latest) return '';
      var titles = {age:'使用年数',symptom:'主な症状',performance:'冷暖房の効き',filter:'フィルター',wash:'専門業者の洗浄',quote:'修理見積もり'};
      var lines = ['【BCサービス エアコン相談｜試作 v' + VERSION + '】'];
      names.forEach(function (k) { var f = fields[k]; lines.push(titles[k] + '：' + (f.value ? f.options[f.selectedIndex].text : '未入力')); });
      lines.push('焦げ臭さ・プラグ発熱・ブレーカー落ち：このチェックでは未確認');
      lines.push('初期案内：' + latest.heading, 'ご案内：' + latest.advice);
      if (latest.status === 'caution') lines.push('注意：' + warning.textContent);
      if (latest.pcts) lines.push('検討割合：買い替え ' + latest.pcts.replace + '%／修理・点検 ' + latest.pcts.repair + '%／クリーニング ' + latest.pcts.clean + '%');
      else lines.push('検討割合：安全確認優先のため算出なし');
      lines.push('次の確認：' + latest.next, '※％は仮の配点による目安です。故障確率・修理成功率ではありません。', '型番・写真を添えて相談します。');
      return lines.join('\n');
    }
    async function copy() {
      var text = summary();
      if (!text) return;
      var version = copyVersion;
      var ok = false;
      try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch (_error) { /* Fall back to selectable text. */ }
      if (version !== copyVersion) return;
      if (!ok) {
        manual.value = text;
        manual.hidden = false;
        manual.focus();
        manual.select();
        manual.setSelectionRange(0, text.length);
        try { ok = document.execCommand('copy'); } catch (_error) { ok = false; }
        if (ok) manual.hidden = true;
      }
      status.textContent = ok ? 'コピーしました。LINEに貼り付けてください。' : '下の文章を長押ししてコピーしてください。';
    }
    function reset() {
      submitted = false;
      fields.age.value = ''; fields.symptom.value = '';
      fields.performance.value = 'unknown'; fields.filter.value = 'unknown'; fields.wash.value = 'unknown'; fields.quote.value = 'none';
      form.querySelector('.optional').open = false;
      update(); fields.age.focus();
    }
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submitted = true;
      update();
      if (!latest) return;
      title.setAttribute('tabindex', '-1');
      title.focus({preventScroll: true});
      panel.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
    });
    form.addEventListener('change', update);
    document.getElementById('bc-copy').addEventListener('click', copy);
    document.getElementById('bc-reset').addEventListener('click', reset);
    update();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {calculate:calculate, version:VERSION, tables:TABLES};
  if (typeof window !== 'undefined') window.BCAirDiagnosis = {calculate:calculate, version:VERSION};
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();

