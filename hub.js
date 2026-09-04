(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    var anchor = e.target.closest('a');
    if (!anchor) return;

    var href = anchor.getAttribute('href') || '';
    var eventName = null;
    if (href.indexOf('https://lin.ee/') === 0) eventName = 'line_click';
    if (href.indexOf('tel:') === 0) eventName = 'phone_click';
    if (!eventName) return;
    if (typeof window.gtag !== 'function') return;

    gtag('event', eventName, {
      event_category: 'engagement',
      event_label: href,
      cta_location: anchor.getAttribute('data-cta-location') || 'unknown',
      transport_type: 'beacon'
    });
  });
})();
