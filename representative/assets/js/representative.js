/* BCサービス代表者の想いページ：既存GA4設定を変更せずCTAクリックのみ送信 */
(function(){
  'use strict';
  document.addEventListener('click', function(event){
    var target=event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!target || typeof window.gtag !== 'function') return;
    var href=target.getAttribute('href') || '';
    var params={page_type:'representative',cta_location:target.getAttribute('data-cta-location')||'other'};
    if (href.indexOf('https://lin.ee/')===0) {
      window.gtag('event','line_click',params);
    } else if (href.indexOf('tel:')===0) {
      window.gtag('event','phone_click',params);
    }
  },{passive:true});
})();