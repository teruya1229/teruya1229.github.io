/* BCサービス / washing-machine-cleaning
 * GA4: existing measurement ID and contact destinations are unchanged.
 * UTM / Google Ads attribution is handled by the existing GA4 page_view.
 * These events measure link clicks, NOT completed LINE inquiries or bookings.
 */
(function () {
  'use strict';

  var PAGE_TYPE = 'washing_machine_cleaning';
  var PAGE_SLUG = '/washing-machine-cleaning/';
  var params = new URLSearchParams(window.location.search);
  var isDebug = params.get('debug') === '1' || params.get('debug_mode') === 'true';

  function getLabel(anchor) {
    return (anchor.textContent || anchor.getAttribute('aria-label') || '')
      .replace(/\s+/g, ' ').trim().substring(0, 100);
  }

  document.addEventListener('click', function (ev) {
    var anchor = ev.target && ev.target.closest && ev.target.closest('a[data-cta-location]');
    if (!anchor || typeof window.gtag !== 'function') return;

    var href = anchor.getAttribute('href') || '';
    var ctaType = href.indexOf('https://lin.ee/') === 0 ? 'line'
      : href.indexOf('tel:') === 0 ? 'tel' : null;
    if (!ctaType) return;

    var locationName = anchor.getAttribute('data-cta-location') || 'unknown';
    var common = {
      page_type: PAGE_TYPE,
      page_slug: PAGE_SLUG,
      page_path: PAGE_SLUG,
      cta_location: locationName,
      cta_type: ctaType,
      cta_target: ctaType,
      cta_label: getLabel(anchor),
      link_url: href,
      debug_flag: isDebug,
      transport_type: 'beacon'
    };
    if (isDebug) {
      // Inspect events without leaving the LP. DebugView still requires a GA4 connection.
      ev.preventDefault();
      common.debug_mode = true;
    }

    if (ctaType === 'line') {
      window.gtag('event', 'cta_click', {
        page_type: PAGE_TYPE,
        page_slug: PAGE_SLUG,
        page_path: PAGE_SLUG,
        cta_location: locationName,
        cta_type: 'line',
        cta_target: 'line',
        cta_label: common.cta_label,
        cta_href: href,
        debug_flag: isDebug,
        debug_mode: isDebug,
        transport_type: 'beacon'
      });
    }

    window.gtag('event', ctaType === 'line' ? 'line_click' : 'phone_click', common);
  }, true);
})();
