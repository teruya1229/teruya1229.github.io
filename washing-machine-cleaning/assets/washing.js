/* BCサービス / washing-machine-cleaning
 * Keep the verified LINE account and existing GA4 measurement.
 * A mobile click opens the official account chat with a prepared message;
 * desktop and JavaScript-disabled visitors retain the verified lin.ee link.
 * Events measure button clicks, NOT LINE inquiries or completed messages.
 */
(function () {
  'use strict';

  var PAGE_TYPE = 'washing_machine_cleaning';
  var PAGE_SLUG = '/washing-machine-cleaning/';
  var LINE_FALLBACK = 'https://lin.ee/tsilra6';
  // LINE official account Basic ID @657tpifw (verified from Official Account Manager).
  var LINE_CHAT_BASE = 'https://line.me/R/oaMessage/%40657tpifw/?';
  var params = new URLSearchParams(window.location.search);
  var isDebug = params.get('debug') === '1' || params.get('debug_mode') === 'true';
  // LINE's official chat URL scheme is supported on iOS/Android, not desktop LINE.
  var isMobileLine = /Android|iPhone|iPod/i.test(navigator.userAgent || '');

  var TYPE = { top: '縦型', drum: 'ドラム式' };
  var AGE = { under1: '1年未満', '1to4': '1〜4年', '5to6': '5〜6年',
    '7to8': '7〜8年', '9plus': '9年以上' };
  var SYMPTOM = {
    flakes: '衣類に汚れ・黒いカスが付く',
    odor: '洗濯機・衣類のニオイが気になる',
    drying: '乾燥しにくい・時間がかかる',
    error: 'エラー表示・途中で止まる',
    spin: '脱水できない',
    vibration: '異常な振動・大きな異音',
    leak: '水漏れしている',
    maintenance: '特に不調なし・予防清掃'
  };

  function getLabel(anchor) {
    return (anchor.textContent || anchor.getAttribute('aria-label') || '')
      .replace(/\s+/g, ' ').trim().substring(0, 100);
  }

  function diagnosisMessage() {
    var form = document.getElementById('washer-diagnosis-form');
    var result = document.getElementById('washer-diagnosis-result');
    if (!form || !result || result.hidden) return '';
    var type = form.elements.namedItem('washer_type');
    var age = form.elements.namedItem('usage_age');
    var symptom = form.elements.namedItem('symptom');
    var typeLabel = type && TYPE[type.value];
    var ageLabel = age && AGE[age.value];
    var symptomLabel = symptom && SYMPTOM[symptom.value];
    if (!typeLabel || !ageLabel || !symptomLabel) return '';
    return '【洗濯機LP・3問診断からのご相談】\n'
      + '洗濯機：' + typeLabel + '\n'
      + '使用年数：' + ageLabel + '\n'
      + '症状：' + symptomLabel + '\n'
      + '型番・写真はこのあと送ります。';
  }

  function preparedMessage(locationName) {
    if (locationName === 'diagnosis_result') {
      var diagnosis = diagnosisMessage();
      if (diagnosis) return diagnosis;
    }
    return '【洗濯機LPからのご相談】\n'
      + '洗濯機の清掃・不調について相談したいです。\n'
      + '型番・写真はこのあと送ります。';
  }

  document.addEventListener('click', function (ev) {
    var anchor = ev.target && ev.target.closest && ev.target.closest('a[data-cta-location]');
    if (!anchor) return;
    var href = anchor.getAttribute('href') || '';
    var isLine = href.indexOf(LINE_FALLBACK) === 0
      || href.indexOf(LINE_CHAT_BASE) === 0;
    var ctaType = isLine ? 'line' : href.indexOf('tel:') === 0 ? 'tel' : null;
    if (!ctaType) return;

    var locationName = anchor.getAttribute('data-cta-location') || 'unknown';
    // Use native link navigation; never auto-send a message or add friends.
    // Run at click time so a completed three-question diagnosis is current.
    if (isLine && isMobileLine && !isDebug) {
      href = LINE_CHAT_BASE + encodeURIComponent(preparedMessage(locationName));
      anchor.setAttribute('href', href);
      // Avoid popup/new-tab handoff failures in Instagram/Facebook in-app browsers.
      anchor.removeAttribute('target');
    }
    if (isDebug) ev.preventDefault();

    // Report the stable verified destination rather than a potentially personal
    // prefilled message in the custom GA4 event payload.
    var safeHref = isLine ? LINE_FALLBACK : href;
    var common = {
      page_type: PAGE_TYPE,
      page_slug: PAGE_SLUG,
      page_path: PAGE_SLUG,
      cta_location: locationName,
      cta_type: ctaType,
      cta_target: ctaType,
      cta_label: getLabel(anchor),
      link_url: safeHref,
      debug_flag: isDebug,
      transport_type: 'beacon'
    };
    if (isDebug) common.debug_mode = true;
    if (typeof window.gtag !== 'function') return;

    // Existing GA4/Ads CTA mapping must remain intact.
    if (isLine) {
      window.gtag('event', 'cta_click', {
        page_type: PAGE_TYPE,
        page_slug: PAGE_SLUG,
        page_path: PAGE_SLUG,
        cta_location: locationName,
        cta_type: 'line',
        cta_target: 'line',
        cta_label: common.cta_label,
        cta_href: safeHref,
        debug_flag: isDebug,
        debug_mode: isDebug,
        transport_type: 'beacon'
      });
    }
    window.gtag('event', isLine ? 'line_click' : 'phone_click', common);
  }, true);

  // Visual-only: do not let the fixed mobile LINE bar cover an in-page LINE CTA.
  // This observes visibility and does not change tracking, destinations or clicks.
  if ('IntersectionObserver' in window && window.matchMedia &&
      window.matchMedia('(max-width: 720px)').matches) {
    var inView = new Set();
    var inlineCtas = document.querySelectorAll('main a.btn--line');
    var ctaObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) inView.add(entry.target);
        else inView.delete(entry.target);
      });
      document.documentElement.classList.toggle('washer-body-line-visible', inView.size > 0);
    }, { rootMargin: '0px 0px 70px 0px', threshold: 0 });
    inlineCtas.forEach(function (anchor) { ctaObserver.observe(anchor); });
  }

})();
