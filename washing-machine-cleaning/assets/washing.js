/* BCサービス / washing-machine-cleaning: CTA tracking only. GA4 settings are unchanged. */
(function(){
  'use strict';
  document.addEventListener('click',function(ev){
    var target=ev.target && ev.target.closest && ev.target.closest('a[data-cta-location]');
    if(!target || typeof window.gtag!=='function')return;
    var dest=target.getAttribute('href')||'';
    var common={page_type:'washing_machine_cleaning',cta_location:target.dataset.ctaLocation,page_path:'/washing-machine-cleaning/'};
    if(dest.indexOf('https://lin.ee/tsilra6')===0){window.gtag('event','line_click',common);}
    else if(dest.indexOf('tel:')===0){window.gtag('event','phone_click',common);}
  },{passive:true});
})();