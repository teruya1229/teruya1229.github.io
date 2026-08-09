(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var isDebug = params.get('debug') === '1' || params.get('debug_mode') === 'true';
  var PAGE_TYPE = 'house_cleaning_lp';
  var PAGE_SLUG = '/house-cleaning/';

  var debugToastTimer = null;
  function showDebugToast() {
    if (!isDebug) return;
    if (debugToastTimer) clearTimeout(debugToastTimer);
    var prev = document.querySelector('.ga-debug-toast');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    var el = document.createElement('div');
    el.className = 'ga-debug-toast';
    el.textContent = '\u8A08\u6E2COK';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = 'position:fixed;bottom:80px;right:16px;padding:10px 14px;font-size:14px;font-weight:700;border-radius:999px;background:#16a34a;color:#fff;z-index:99999;box-shadow:0 8px 20px rgba(0,0,0,.18);pointer-events:none;';
    document.body.appendChild(el);
    debugToastTimer = setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      debugToastTimer = null;
    }, 1800);
  }
  window.__bcShowDebugToast = showDebugToast;

  function detectLocation(anchor) {
    var attrLoc = anchor.getAttribute('data-cta-location');
    if (attrLoc) return attrLoc;
    var node = anchor;
    while (node && node !== document.body) {
      var id = (node.id || '').toLowerCase();
      var cls = (typeof node.className === 'string' ? node.className : '').toLowerCase();
      var combined = id + ' ' + cls;
      if (/\b(fv|hero|section--hero)\b/.test(combined)) return 'hero';
      if (/\b(header|site-header)\b/.test(combined)) return 'header';
      if (/\b(fixed-line-cta)\b/.test(combined)) return 'fixed';
      if (/\b(section--final|final-cta)\b/.test(combined)) return 'bottom';
      if (/\b(section--price|price)\b/.test(combined)) return 'price';
      if (/\b(section--water|water)\b/.test(combined)) return 'water';
      if (/\b(section--floor|floor)\b/.test(combined)) return 'floor';
      if (/\b(section--pressure|pressure)\b/.test(combined)) return 'pressure';
      if (/\b(section--aircon|aircon)\b/.test(combined)) return 'aircon';
      node = node.parentElement;
    }
    return 'unknown';
  }

  function detectCtaType(href) {
    if (!href) return null;
    if (href.indexOf('https://lin.ee/') === 0) return 'line';
    if (href.indexOf('tel:') === 0) return 'tel';
    return null;
  }

  function getLabel(anchor) {
    var text = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) return text.substring(0, 100);
    return anchor.getAttribute('aria-label') || anchor.getAttribute('title') || '';
  }

  document.addEventListener('click', function (e) {
    var anchor = e.target.closest('a');
    if (!anchor) return;

    var href = anchor.getAttribute('href') || '';
    var ctaType = detectCtaType(href);
    if (!ctaType) return;

    var eventData = {
      cta_type: ctaType,
      cta_target: ctaType,
      cta_label: getLabel(anchor),
      cta_href: href,
      cta_location: detectLocation(anchor),
      page_type: PAGE_TYPE,
      page_slug: PAGE_SLUG,
      debug_flag: isDebug
    };

    if (typeof window.gtag === 'function') {
      if (isDebug) {
        e.preventDefault();
        gtag('event', 'cta_click', {
          cta_type: eventData.cta_type,
          cta_target: eventData.cta_target,
          cta_label: eventData.cta_label,
          cta_href: eventData.cta_href,
          cta_location: eventData.cta_location,
          page_type: eventData.page_type,
          page_slug: eventData.page_slug,
          debug_flag: eventData.debug_flag
        });
      } else {
        gtag('event', 'cta_click', {
          cta_type: eventData.cta_type,
          cta_target: eventData.cta_target,
          cta_label: eventData.cta_label,
          cta_href: eventData.cta_href,
          cta_location: eventData.cta_location,
          page_type: eventData.page_type,
          page_slug: eventData.page_slug,
          debug_flag: eventData.debug_flag,
          transport_type: 'beacon'
        });
      }
    } else {
      console.log('[GA4 CTA]', eventData);
      if (isDebug) e.preventDefault();
    }

    if (isDebug) showDebugToast();
  }, true);
})();
