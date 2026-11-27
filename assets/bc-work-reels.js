/* Load Instagram's official embed only when a visitor requests it. */
document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('.bc-reel-media[data-reel-id]').forEach(function(media){
    var id=media.dataset.reelId,button=media.querySelector('[data-reel-open]'),panel=media.querySelector('.bc-reel-inline');
    if(!/^[A-Za-z0-9_-]{11}$/.test(id)||!button||!panel)return;
    button.hidden=false;
    button.addEventListener('click',function(){
      var frame=panel.querySelector('iframe');
      if(frame){frame.remove();panel.hidden=true;button.setAttribute('aria-expanded','false');button.textContent='ページ内で見る';return;}
      var el=document.createElement('iframe');
      el.src='https://www.instagram.com/reel/'+id+'/embed/';
      el.title=media.dataset.reelTitle+'（Instagram）';
      el.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';
      el.allowFullscreen=true;el.referrerPolicy='strict-origin-when-cross-origin';
      panel.prepend(el);panel.hidden=false;button.setAttribute('aria-expanded','true');button.textContent='ページ内表示を閉じる';
    });
  });
});
