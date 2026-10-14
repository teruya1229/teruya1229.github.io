(function(){
  'use strict';
  const tabs=Array.from(document.querySelectorAll('[role="tab"][data-audience]'));
  const panels={home:document.getElementById('panel-home'),business:document.getElementById('panel-business')};
  if(tabs.length!==2 || !panels.home || !panels.business) return;

  // GA4 shares the measurement ID already used across the BC Service website.
  // Page views are sent once by the gtag config in index.html, not here.
  function track(eventName,details){
    if(typeof window.gtag!=='function')return;
    window.gtag('event',eventName,Object.assign({page_type:'prices',page_path:'/prices/'},details));
  }
  function activate(type,focus){
    if(!panels[type])return;
    tabs.forEach(function(tab){
      const active=tab.dataset.audience===type;
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
      if(active&&focus)tab.focus();
    });
    Object.keys(panels).forEach(function(key){panels[key].hidden=key!==type;});
  }
  function selectAudience(type,focus){
    if(!panels[type])return;
    activate(type,focus);
    track('prices_category_select',{audience_type:type});
  }

  const incoming=(location.hash==='#business'||new URLSearchParams(location.search).get('view')==='business')?'business':'home';
  activate(incoming,false);
  tabs.forEach(function(tab){
    tab.addEventListener('click',function(){
      selectAudience(tab.dataset.audience,false);
      history.replaceState(null,'','#'+(tab.dataset.audience==='business'?'business':'home'));
    });
  });
  const group=document.querySelector('.audience-switch');
  if(group)group.addEventListener('keydown',function(ev){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;
    ev.preventDefault();
    const current=tabs.findIndex(function(tab){return tab.getAttribute('aria-selected')==='true';});
    const next=(ev.key==='Home')?0:(ev.key==='End')?tabs.length-1:(current+(ev.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    selectAudience(tabs[next].dataset.audience,true);
  });
  window.addEventListener('hashchange',function(){
    if(location.hash==='#business')activate('business',false);
    else if(location.hash==='#home')activate('home',false);
  });

  // Track clicks on each actual service link. No personal data is sent.
  document.addEventListener('click',function(ev){
    const link=ev.target&&ev.target.closest&&ev.target.closest('a.detail-link');
    if(!link)return;
    const card=link.closest('.price-card');
    const panel=link.closest('.audience-panel');
    if(!card||!panel)return;
    const heading=card.querySelector('h4');
    track('prices_service_click',{
      audience_type:panel.id==='panel-business'?'business':'home',
      service_name:heading?heading.textContent.trim():'unknown',
      service_path:link.pathname,
      link_url:link.href
    });
  });
})();