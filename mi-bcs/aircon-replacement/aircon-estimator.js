/* BC Service aircon replacement estimator: only confirmed public LP fees are calculated. */
(function () {
  'use strict';
  var root = document.getElementById('aircon-estimator');
  if (!root) return;
  var sizes = { '6': 99800, '8': 119800, '10': 129800, '14': 149800 };
  var stairFees = { 'standard': 0, '3': 2200, '4': 3300, '5': 4400, '6plus': null };
  var details = [
    ['ae-pipe', '配管4mを超える可能性'],
    ['ae-cover', '配管の化粧カバー'],
    ['ae-location', '室外機が地面・ベランダ以外の場所'],
    ['ae-power', '専用回路・コンセント・電圧切替など'],
    ['ae-hole', '新規穴あけ・特殊な壁'],
    ['ae-other', 'その他の特殊作業']
  ];
  var sizeEl = document.getElementById('ae-size');
  var stairsEl = document.getElementById('ae-stairs');
  var baseEl = document.getElementById('ae-base');
  var extraEl = document.getElementById('ae-extra');
  var totalEl = document.getElementById('ae-total');
  var quoteEl = document.getElementById('ae-quote');
  var copyEl = document.getElementById('ae-copy');
  var statusEl = document.getElementById('ae-status');
  if (!sizeEl || !stairsEl || !baseEl || !extraEl || !totalEl || !quoteEl || !copyEl || !statusEl) return;
  function yen(n) { return n.toLocaleString('ja-JP') + '円'; }
  function quoteItems() {
    var result = [];
    if (stairsEl.value === '6plus') result.push('エレベーターなし6階以上の搬入・搬出');
    details.forEach(function (entry) {
      var input = document.getElementById(entry[0]);
      if (input && input.checked) result.push(entry[1]);
    });
    return result;
  }
  function summary() {
    var base = sizes[sizeEl.value];
    var stairs = stairFees[stairsEl.value];
    var extras = quoteItems();
    var stairAmount = stairs === null ? 0 : stairs;
    var floorLabel = stairsEl.options[stairsEl.selectedIndex].text;
    return {
      base: base,
      stairAmount: stairAmount,
      extras: extras,
      text: '【BCサービス エアコン買替え概算相談】\n' +
        '畳数：' + sizeEl.value + '畳\n' +
        '階段搬入条件：' + floorLabel + '\n' +
        'LP掲載の標準入替え価格：' + yen(base) + '〜\n' +
        '確定している階段作業費：' + yen(stairAmount) + '\n' +
        '現在計算できる下限目安：' + yen(base + stairAmount) + '〜\n' +
        '別途確認したい項目：' + (extras.length ? extras.join('、') : '特になし（現地条件により変わる場合があります）') + '\n' +
        '※本体・標準取付・標準撤去・リサイクル対応・工事5年保証込みの買替えプラン。配管等の別途見積費用は未加算です。正式金額と施工可否を確認してください。'
    };
  }
  function update() {
    var data = summary();
    baseEl.textContent = yen(data.base) + '〜';
    extraEl.textContent = '+' + yen(data.stairAmount);
    totalEl.textContent = yen(data.base + data.stairAmount) + '〜';
    quoteEl.textContent = data.extras.length
      ? '次の項目は金額未加算・別途確認：\n・' + data.extras.join('\n・')
      : '追加工事が発生しなければ上記が標準入替え価格の目安です。';
    statusEl.textContent = '';
  }
  async function copySummary() {
    var value = summary().text;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        var temp = document.createElement('textarea');
        temp.value = value;
        temp.setAttribute('readonly', '');
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(temp);
        if (!ok) throw new Error('copy unavailable');
      }
      statusEl.textContent = 'コピーしました。LINEを開いて貼り付けてください。';
    } catch (_error) {
      statusEl.textContent = 'コピーできませんでした。画面の条件をLINEでお知らせください。';
    }
  }
  root.addEventListener('change', update);
  copyEl.addEventListener('click', copySummary);
  update();
})();
