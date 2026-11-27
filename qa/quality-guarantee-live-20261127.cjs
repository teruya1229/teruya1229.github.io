const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const root='https://teruya1229.github.io/',out='qa-quality-live',manifest=JSON.parse(fs.readFileSync('.github/scripts/quality-guarantee.json','utf8'));
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(out+'/shots',{recursive:true});
const policy={path:'quality-guarantee/index.html',variant:'policy',detail:false},pages=[...manifest.pages,policy];
const widths=[1440,390,320],heights={1440:900,390:844,320:568};
const routeFor=p=>p.path.replace(/(^|\/)index\.html$/,'$1');
const norm=s=>s.replace(/\r\n/g,'\n').trim();
const sameHost=u=>u.startsWith(root);
const targetSha='4abc651e5ec5aaf011a936aa062ae7ce2344de56';
const isCTA=/^(https?:\/\/(?:lin\.ee\/|line\.me\/|airrsv\.net\/)|tel:)/i;
const all=[];
const errors=[];
const slug=p=>p.path.replace(/\/index\.html$/,'').replace(/\.html$/,'').replace(/\//g,'_');
async function browserCase(browser,entry,w){
 const url=root+routeFor(entry), key=slug(entry)+'-'+w, row={page:entry.path,width:w,errors:[],warnings:[],qa:{}};
 const ctx=await browser.newContext({viewport:{width:w,height:heights[w]},deviceScaleFactor:1,reducedMotion:'reduce',isMobile:w<500,hasTouch:w<500});
 try{
 await ctx.route('**/*',async r=>{const u=r.request().url();if(sameHost(u)||/^data:|^blob:|^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u))return r.continue();return r.abort('blockedbyclient')});
 await ctx.addInitScript(()=>{window.__bcQaClicks=[];document.addEventListener('click',e=>{let a=e.target.closest?.('a');if(!a)return;const h=a.getAttribute('href')||'';if(/^(https?:\/\/(?:lin\.ee\/|line\.me\/|airrsv\.net\/)|tel:)/i.test(h)){window.__bcQaClicks.push({href:h,label:(a.innerText||a.getAttribute('aria-label')||'').trim(),trusted:e.isTrusted});e.preventDefault();}},true)});
 const p=await ctx.newPage();p.setDefaultTimeout(4500);
 const bad=new Set();
 p.on('pageerror',e=>row.errors.push('JS: '+e.message));
 p.on('response',r=>{if(sameHost(r.url())&&r.status()>=400)bad.add(r.status()+' '+r.url())});
 const res=await p.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 row.http=res?.status();row.qa.source=norm(await res.text())===norm(fs.readFileSync(entry.path,'utf8'));
 if(row.http!==200)row.errors.push('HTTP '+row.http);
 if(!row.qa.source)row.errors.push('Live HTML differs from checked-out source');
 await p.evaluate(async()=>{if(document.fonts)await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,3000))]);});
 await p.evaluate(()=>scrollTo(0,0));
 // Decode first-viewport images for screenshots; later all local images are requested.
 await p.evaluate(async()=>{const imgs=[...document.images].filter(x=>x.getBoundingClientRect().top<innerHeight+100&&x.getBoundingClientRect().height>0);await Promise.race([Promise.all(imgs.map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,4500))]);});
 const layout=await p.evaluate(({detail,variant,viewportWidth})=>{
  const r=e=>e.getBoundingClientRect(),vis=e=>!!(e&&r(e).width&&r(e).height&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none');
  const fits=e=>vis(e)&&r(e).left>=-1&&r(e).right<=innerWidth+1;
  const brief=document.querySelector('.bcq-brief'),d=document.querySelector('.bcq-detail');
  const a=[...document.querySelectorAll('a[href]')].map(e=>({href:e.getAttribute('href'),visible:vis(e),y:r(e).top,aboveFold:vis(e)&&r(e).top>=0&&r(e).bottom<=innerHeight,label:(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,80)}));
  const links=a.filter(x=>x.href.startsWith('/quality-guarantee/'));
  const nodes=[...document.querySelectorAll('body *')].filter(e=>vis(e)&&r(e).width>0&&(r(e).right>innerWidth+2||r(e).left< -2)&&!['SCRIPT','STYLE','SVG','PATH','IFRAME'].includes(e.tagName.toUpperCase())).map(e=>({tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className.slice(0,80):'',left:Math.round(r(e).left),right:Math.round(r(e).right)})).slice(0,8);
  const ctas=a.filter(x=>/^(https?:\/\/(?:lin\.ee\/|line\.me\/|airrsv\.net\/)|tel:)/i.test(x.href));
  return {viewport:innerWidth,requested:viewportWidth,docWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,brief:brief?{visible:vis(brief),fit:fits(brief),top:Math.round(r(brief).top),height:Math.round(r(brief).height),text:brief.innerText}:null,detail:d?{visible:vis(d),fit:fits(d)}:null,links,ctas,nodes,ids:[...document.querySelectorAll('[id]')].map(e=>e.id),css:!!document.querySelector('link[href="/assets/bc-quality-guarantee.css"]')&&[...document.styleSheets].some(x=>x.href?.endsWith('/assets/bc-quality-guarantee.css')),faq:[...new Set(document.querySelectorAll('#faq details,.faq details,.faq-list details,.biz3-faq details,details.faq-details'))].length};
 },{detail:entry.detail,variant:entry.variant,viewportWidth:w});
 row.layout={...layout,ids:undefined,ctas:layout.ctas.map(x=>({href:x.href,label:x.label,aboveFold:x.aboveFold})),links:layout.links.map(x=>({href:x.href,visible:x.visible}))};
 if(layout.viewport!==w)row.errors.push('Viewport CSS width '+layout.viewport+' expected '+w);
 if(layout.docWidth>w+1||layout.bodyWidth>w+1)row.errors.push('Horizontal overflow '+layout.docWidth+'/'+layout.bodyWidth);
 if(!layout.css)row.errors.push('Guarantee CSS not applied');
 if(entry.variant!=='policy'){
 if(!layout.brief?.fit)row.errors.push('Guarantee brief hidden or clipped');
 if(entry.detail&&!layout.detail?.fit)row.errors.push('Guarantee detail hidden or clipped');
 if(!layout.links.some(a=>a.visible))row.errors.push('No visible guarantee link');
 if(entry.detail&&!layout.ctas.some(a=>a.visible))row.errors.push('No visible LINE/tel/reservation CTA');
 }else if(!['scope','contract'].every(id=>layout.ids.includes(id)))row.errors.push('Policy anchors missing');
 await p.screenshot({path:out+'/shots/'+key+'-top.png',animations:'disabled',timeout:12000});
 // Capture assurance section on all 3 widths. End-placed support pages may not be in top screenshot.
 const focus=p.locator(entry.variant==='policy'?'.bcq-lead':'.bcq-brief').first();
 if(await focus.count()){await focus.evaluate(e=>e.scrollIntoView({block:'center'}));await p.screenshot({path:out+'/shots/'+key+'-guarantee.png',animations:'disabled',timeout:12000})}
 // Check each local image actually decodes; external embeds are intentionally not contacted.
 row.images=await p.evaluate(async()=>{const imgs=[...document.images].filter(i=>{try{return new URL(i.currentSrc||i.src,location.href).origin===location.origin}catch{return false}});imgs.forEach(i=>{i.loading='eager'});await Promise.race([Promise.all(imgs.map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,9000))]);return{local:imgs.length,loaded:imgs.filter(i=>i.complete&&i.naturalWidth>0).length,bad:imgs.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src')),external:document.images.length-imgs.length}});
 if(row.images.bad.length)row.errors.push('Local image load failure '+row.images.bad.join(','));
 if(w===390){
 // Test real user clicks without sending LINE, phone, bookings or real GA traffic.
 const events=()=>p.evaluate(()=>Array.from(window.dataLayer||[]).filter(x=>x&&x[0]==='event').map(x=>({name:x[1],data:x[2]})));
 row.ctaTests=[];
 for(const [type,selector] of [['line','a[href^="https://lin.ee/"],a[href^="https://line.me/"]'],['tel','a[href^="tel:"]'],['reserve','a[href^="https://airrsv.net/"]']]){
 const loc=p.locator(selector);let chosen=null;for(let i=0;i<await loc.count();i++){if(await loc.nth(i).isVisible()){chosen=loc.nth(i);break}}
 if(!chosen)continue;
 const href=await chosen.getAttribute('href'),before=(await events()).length,n=await p.evaluate(()=>window.__bcQaClicks.length);
 try{await chosen.evaluate(e=>e.scrollIntoView({block:'center'}));await chosen.click({timeout:4000});const ev=(await events()).slice(before);const click=await p.evaluate(()=>window.__bcQaClicks.at(-1));const seen=await p.evaluate(()=>window.__bcQaClicks.length);const pass=seen>n&&click.trusted;row.ctaTests.push({type,href,clicked:pass,actualHref:click?.href,events:ev.map(x=>x.name),eventData:ev.filter(x=>['line_click','phone_click','cta_click','business_contact_click'].includes(x.name)).map(x=>({name:x.name,page_type:x.data?.page_type,page_slug:x.data?.page_slug,cta_type:x.data?.cta_type}))});if(!pass)row.errors.push('CTA click not captured: '+type);if(entry.path==='business-cleaning/index.html'&&['line','tel'].includes(type)&&!ev.some(x=>x.name==='business_contact_click'))row.errors.push('Business dedicated event missing '+type);if(entry.path==='complete-disassembly/index.html'&&['line','tel'].includes(type)&&!ev.some(x=>x.name===(type==='line'?'line_click':'phone_click')))row.errors.push('Complete event missing '+type);
 }catch(e){row.errors.push('CTA '+type+': '+e.message.slice(0,220))}
 }
 const faqs=p.locator('#faq details,.faq details,.faq-list details,.biz3-faq details,details.faq-details');
 row.faqTest={total:await faqs.count(),tested:0,pass:0,hidden:0};
 for(let i=0;i<await faqs.count();i++){const d=faqs.nth(i),s=d.locator(':scope > summary');if(!await s.count()||!await s.isVisible()){row.faqTest.hidden++;continue}row.faqTest.tested++;try{const was=await d.evaluate(e=>e.open);await s.evaluate(e=>e.scrollIntoView({block:'center'}));await s.click({timeout:3000});const toggled=await d.evaluate(e=>e.open)!==was;await s.click({timeout:3000});const restored=await d.evaluate(e=>e.open)===was;if(toggled&&restored)row.faqTest.pass++;else row.errors.push('FAQ toggle failed '+i)}catch(e){row.errors.push('FAQ '+i+': '+e.message.slice(0,160))}}
 if(entry.path==='washing-machine-cleaning/index.html'){
 row.diagnosis=[];
 const form=p.locator('#washer-diagnosis-form'),result=p.locator('#washer-diagnosis-result');
 for(const type of ['top','drum']){
 try{await form.locator('input[name="washer_type"][value="'+type+'"]').check();for(const name of ['usage_age','symptom']){const sel=form.locator('select[name="'+name+'"]');const v=await sel.locator('option').evaluateAll(es=>es.find(e=>e.value&&!e.disabled)?.value);await sel.selectOption(v)}const before=(await events()).length;await form.locator('button[type="submit"]').click();await result.waitFor({state:'visible'});const bars=await result.locator('[role="progressbar"]').evaluateAll(es=>es.map(e=>Number(e.getAttribute('aria-valuenow'))));const ev=(await events()).slice(before).map(x=>x.name);row.diagnosis.push({type,bars,events:ev,visible:await result.isVisible(),line:await result.locator('a[data-cta-location="diagnosis_result"]').getAttribute('href')});if(bars.length!==3||bars.reduce((a,b)=>a+b,0)!==100||!ev.includes('diagnosis_submit')||!ev.includes('diagnosis_result_view'))row.errors.push('Diagnosis event or scores '+type)}catch(e){row.errors.push('Diagnosis '+type+': '+e.message.slice(0,220))}
 }
 await result.screenshot({path:out+'/shots/'+key+'-diagnosis.png',animations:'disabled',timeout:12000}).catch(e=>row.warnings.push('diagnosis screenshot '+e.message));
 }
 if(entry.variant!=='policy'){
 try{const a=p.locator('a.bcq-link[href^="/quality-guarantee/"]').first();const href=await a.getAttribute('href');await a.evaluate(e=>e.scrollIntoView({block:'center'}));await a.click({timeout:4000});await p.waitForURL('**/quality-guarantee/**',{timeout:8000});const hash=new URL(p.url()).hash.slice(1);row.qa.policyLink={href,destination:p.url(),targetExists:!!hash&&await p.locator('[id="'+hash+'"]').count()>0};if(!row.qa.policyLink.targetExists)row.errors.push('Policy anchor not found')}catch(e){row.errors.push('Policy link click '+e.message.slice(0,180))}
 }
 }
 if(bad.size)row.errors.push('Local HTTP errors '+[...bad].join('; '));
 }catch(e){row.errors.push('Test exception '+e.message.slice(0,400))}finally{await ctx.close()}
 row.pass=!row.errors.length;all.push(row);
 console.log('BCQ_CASE '+JSON.stringify({page:entry.path,width:w,http:row.http,pass:row.pass,source:row.qa.source,images:row.images?.loaded+'/'+row.images?.local,ctas:row.ctaTests?.map(x=>[x.type,x.clicked,x.events]),faq:row.faqTest,errors:row.errors,warnings:row.warnings}));
}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});try{
 const jobs=pages.flatMap(p=>widths.map(w=>[p,w]));let ix=0;await Promise.all(Array.from({length:5},async()=>{while(ix<jobs.length){const [p,w]=jobs[ix++];await browserCase(browser,p,w)}}));
 }finally{await browser.close()}
 all.sort((a,b)=>pages.findIndex(p=>p.path===a.page)-pages.findIndex(p=>p.path===b.page)||widths.indexOf(a.width)-widths.indexOf(b.width));
 fs.writeFileSync(out+'/results.json',JSON.stringify({commit:targetSha,pages:pages.length,widths,results:all},null,2));
 const result={pages:pages.length,cases:all.length,pass:all.filter(x=>x.pass).length,failed:all.filter(x=>!x.pass).map(x=>({page:x.page,width:x.width,errors:x.errors})),sourceMatches:all.filter(x=>x.qa.source).length,images:all.reduce((a,x)=>a+(x.images?.loaded||0),0),totalImages:all.reduce((a,x)=>a+(x.images?.local||0),0),faqTests:all.reduce((a,x)=>a+(x.faqTest?.pass||0),0),faqTotal:all.reduce((a,x)=>a+(x.faqTest?.tested||0),0),ctaTests:all.reduce((a,x)=>a+(x.ctaTests?.filter(t=>t.clicked).length||0),0),ctaTotal:all.reduce((a,x)=>a+(x.ctaTests?.length||0),0),policyLinks:all.filter(x=>x.qa.policyLink?.targetExists).length};
 fs.writeFileSync(out+'/summary.json',JSON.stringify(result,null,2));console.log('BCQ_QA_SUMMARY '+JSON.stringify(result));if(result.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});