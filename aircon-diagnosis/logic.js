/* BC aircon triage v0.2: provisional rules, NOT calibrated probabilities.
 * No inputs leave this page automatically. No analytics or storage is added.
 * Safety overrides run before required-field validation. */
(function () {
  'use strict';
  var VERSION = '0.2';
  var KEYS = ['replace', 'repair', 'clean'];
  var LABELS = {replace: '買い替え', repair: '修理・点検', clean: 'クリーニング'};
  var TABLES = {
    age: {new: [-6,10,5], mid: [0,10,5], old: [15,0,0], very_old: [25,-4,-3], unknown: [0,0,0]},
    symptom: {smell: [-4,-5,55], dirt: [-6,-8,60], air: [5,28,18], poor: [14,48,0], stop: [15,65,-10], leak: [6,60,-10], noise: [9,65,-10], none: [0,-8,5], maintenance: [0,-8,20]},
    performance: {normal: [-2,-5,10], weak: [5,15,5], none: [10,40,-15], unknown: [0,0,0]},
    filter: {dirty: [0,0,12], clean: [0,0,-2], unknown: [0,0,0]},
    wash: {recent: [0,0,-10], some: [0,0,4], old: [0,0,10], never: [0,0,14], unknown: [0,0,0]},
    quote: {none: [0,0,0], under: [-8,30,0], medium: [3,16,0], high: [20,4,0], very_high: [40,-5,0], unavailable: [80,-15,-20]}
  };
  var SYMPTOM_REASON = {
    smell: 'ニオイが主な悩みのため、汚れの確認を重視しました。焦げ臭さは別扱いです。',
    dirt: '内部の目に見える汚れを、清掃を検討する材料にしました。',
    air: '風量低下は汚れだけでなく機器側の問題も考え、点検も比較します。',
    poor: '冷暖房の不調は原因が複数あるため、清掃だけで直るとは判断しません。',
    stop: 'エラー・途中停止があるため、清掃を頼む前に原因確認を優先します。',
    leak: '水漏れがあるため、使用を控えて排水経路などの点検を優先します。',
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
    if (input.danger !== 'no' && input.danger !== false) return null;
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
    if (['stop','leak','noise'].indexOf(v.symptom) !== -1 || v.performance === 'none') score[2] = Math.min(score[2], 7);
    else if (v.symptom === 'poor' || quoted) score[2] = Math.min(score[2], 20);
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
    var heading = nearTie ? '現時点では2つの方向を比較' : 'まず「' + LABELS[leader] + '」を検討';
    var advice = {
      replace: '新品の総額と修理見積もりを比較する方向です。型番・部品供給・保証の有無を確認してから決めましょう。',
      repair: 'まず不具合の原因確認を。修理可能か、いくらかかるかが分かってから買い替えと比較します。',
      clean: '正常運転していて汚れが中心なら、清掃を検討する方向です。汚れの場所と程度を確認し、フィルターのお手入れだけでよいかも確認します。'
    }[leader];
    if (nearTie) advice = LABELS[sorted[0]] + 'と' + LABELS[sorted[1]] + 'の目安が近い状態です。型番・写真・点検結果を確認して判断します。';
    if (noProblem) { heading = '今すぐ作業が必要とは判断しません'; advice = '以下は、相談するときの方向性の比較です。不具合がなければ、状態確認と普段のお手入れだけでよい場合もあります。'; }
    if (caution) { heading = '使用を止めて、まず点検を'; advice = '水漏れ・異常な音は点検を優先してください。下の割合は、その後に検討する対応の目安で、再運転や清掃を勧めるものではありません。'; }
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
    var names = ['danger','age','symptom','performance','filter','wash','quote'];
    var fields = {};
    names.forEach(function (k) { fields[k] = document.getElementById('q-' + k); });
    if (names.some(function (k) { return !fields[k]; })) return;
    var results = document.getElementById('bc-results');
    var placeholder = document.getElementById('bc-placeholder');
    var title = document.getElementById('bc-result-title');
    var advice = document.getElementById('bc-advice');
    var notes = document.getElementById('bc-notes');
    var warning = document.getElementById('bc-warning');
    var bars = document.getElementById('bc-bars');
    var status = document.getElementById('bc-copy-status');
    var manual = document.getElementById('bc-manual');
    var latest = null;
    var copyVersion = 0;
    function values() { var v = {}; names.forEach(function (k) { v[k] = fields[k].value; }); return v; }
    function update() {
      copyVersion++;
      latest = calculate(values());
      status.textContent = '';
      manual.hidden = true;
      manual.value = '';
      results.hidden = !latest;
      placeholder.hidden = !!latest;
      document.getElementById('bc-mobile-jump').hidden = !latest;
      if (!latest) return;
      title.textContent = latest.heading;
      advice.textContent = latest.advice;
      warning.hidden = latest.status === 'ok';
      warning.textContent = latest.status === 'hold' ? '安全状態が不明なため、％の表示を保留しています。' : '割合の比較より、使用中止・安全確認・点検が先です。';
      bars.hidden = !latest.pcts;
      document.getElementById('bc-score-caption').hidden = !latest.pcts;
      KEYS.forEach(function (k) {
        var n = latest.pcts ? latest.pcts[k] : 0;
        document.getElementById('bc-pct-' + k).textContent = latest.pcts ? n + '%' : '—';
        document.getElementById('bc-fill-' + k).style.width = n + '%';
        document.getElementById('bc-bar-' + k).setAttribute('aria-valuenow', String(n));
      });
      while (notes.firstChild) notes.removeChild(notes.firstChild);
      latest.reasons.forEach(function (reason) { var li = document.createElement('li'); li.textContent = reason; notes.appendChild(li); });
      document.getElementById('bc-next').textContent = latest.next;
    }
    function summary() {
      if (!latest) return '';
      var titles = {danger:'危険な症状',age:'使用年数',symptom:'主な症状',performance:'冷暖房の効き',filter:'フィルター',wash:'専門業者の洗浄',quote:'修理見積もり'};
      var lines = ['【BCサービス エアコン相談｜試作 v' + VERSION + '】'];
      names.forEach(function (k) { var f = fields[k]; lines.push(titles[k] + '：' + (f.value ? f.options[f.selectedIndex].text : '未入力')); });
      lines.push('初期案内：' + latest.heading);
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
      status.textContent = ok ? 'コピーしました。LINEを開き、貼り付けて送信してください。' : '下の相談文を長押し・選択してコピーしてください。自動送信はされません。';
    }
    function reset() {
      fields.danger.value = ''; fields.age.value = ''; fields.symptom.value = '';
      fields.performance.value = 'unknown'; fields.filter.value = 'unknown'; fields.wash.value = 'unknown'; fields.quote.value = 'none';
      update(); fields.danger.focus();
    }
    var examples = {
      clean: {danger:'no',age:'mid',symptom:'dirt',performance:'normal',filter:'dirty',wash:'never',quote:'none'},
      repair: {danger:'no',age:'new',symptom:'stop',performance:'none',filter:'clean',wash:'recent',quote:'under'},
      replace: {danger:'no',age:'very_old',symptom:'poor',performance:'none',filter:'clean',wash:'recent',quote:'very_high'}
    };
    root.addEventListener('change', update);
    document.getElementById('bc-copy').addEventListener('click', copy);
    document.getElementById('bc-reset').addEventListener('click', reset);
    document.querySelectorAll('[data-example]').forEach(function (button) {
      button.addEventListener('click', function () {
        var example = examples[button.getAttribute('data-example')];
        if (!example) return;
        names.forEach(function (k) { fields[k].value = example[k]; }); update();
        document.getElementById('bc-result-panel').scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
      });
    });
    update();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {calculate:calculate, version:VERSION, tables:TABLES};
  if (typeof window !== 'undefined') window.BCAirDiagnosis = {calculate:calculate, version:VERSION};
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
