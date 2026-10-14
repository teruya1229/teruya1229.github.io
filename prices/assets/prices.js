(function(){
  'use strict';
  const tabs=Array.from(document.querySelectorAll('[role="tab"][data-audience]'));
  const panels={home:document.getElementById('panel-home'),business:document.getElementById('panel-business')};
  if(tabs.length!==2 || !panels.home || !panels.business) return;
  function activate(type,focus){
    if(!panels[type]) return;
    tabs.forEach(function(tab){const active=tab.dataset.audience===type;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();});
    Object.keys(panels).forEach(function(key){panels[key].hidden=key!==type;});
  }
  const incoming=(location.hash==='#business'||new URLSearchParams(location.search).get('view')==='business')?'business':'home';
  activate(incoming,false);
  tabs.forEach(function(tab){tab.addEventListener('click',function(){activate(tab.dataset.audience,false);history.replaceState(null,'','#'+(tab.dataset.audience==='business'?'business':'home'));});});
  const group=document.querySelector('.audience-switch');
  if(group)group.addEventListener('keydown',function(ev){if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;ev.preventDefault();const current=tabs.findIndex(t=>t.getAttribute('aria-selected')==='true');const next=(ev.key==='Home')?0:(ev.key==='End')?tabs.length-1:(current+(ev.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activate(tabs[next].dataset.audience,true);});
  window.addEventListener('hashchange',function(){if(location.hash==='#business')activate('business',false);else if(location.hash==='#home')activate('home',false);});
})();