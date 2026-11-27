const {chromium}=require('playwright'),fs=require('fs');
const root='https://teruya1229.github.io/',out='qa-quality-recheck';
fs.mkdirSync(out,{recursive:true});
const rows=[];const wait=ms=>new Promise(r=>setTimeout(r,ms));
const view=async(p,w)=>p.evaluate(({w})=>{const geom=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{y:Math.round(r.top+scrollY),height:Math.round(r.height),order:getComputedStyle(e).order,visible:r.height>0,tag:e.tagName}};return{h1:geom('main h1'),brief:geom('.bcq-brief'),detail:geom('.bcq-detail'),faq:geom('#faq'),hero:geom('main .hero'),scroll:document.documentElement.scrollWidth,width:innerWidth}}, {w});
const fail=(a,m)=>{if(!a)throw Error(m)};
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
 for(const w of [1440,390,320]){
  const p=await b.newPage({viewport:{width:w,height:w===1440?900:w===390?844:568},deviceScaleFactor:1,reducedMotion:'reduce'});
  await p.route('**/*',r=>{const u=r.request().url();return u.startsWith(root)||u.startsWith('data:')||/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)?r.continue():r.abort()});
  try{
   await p.goto(root+'complete-disassembly/',{waitUntil:'domcontentloaded'});const img=await p.evaluate(async()=>{const es=[...document.images].filter(i=>i.getAttribute('src')?.trim());await Promise.all(es.map(i=>{i.loading='eager';return i.decode().catch(()=>{})}));return {total:es.length,ok:es.filter(i=>i.naturalWidth>0).length,empty:[...document.images].filter(i=>!i.getAttribute('src')).map(i=>({cls:i.className,hidden:!i.getBoundingClientRect().width}))}});const link=p.locator('a.cd-proof-photo-link').first(),dialog=p.locator('#cd-photo-dialog');
   await link.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await link.click({timeout:8000});await dialog.waitFor({state:'visible'});const decoded=await dialog.locator('img').evaluate(async i=>{await i.decode();return {width:i.naturalWidth,src:i.src}});await dialog.screenshot({path:out+'/complete-dialog-'+w+'.png',animations:'disabled'});await dialog.locator('button').click();const closed=await dialog.evaluate(e=>!e.open);fail(img.ok===img.total&&decoded.width>0&&closed,'image/dialog failure');rows.push({type:'complete',w,img,dialog:decoded,closed,pass:true});
  }catch(e){rows.push({type:'complete',w,pass:false,error:e.message})}
  try{
   await p.goto(root+'lighting/',{waitUntil:'domcontentloaded'});const d=p.locator('#faq details,.faq details,.faq-list details,.biz3-faq details,details.faq-details');let tests=[];for(let i=0;i<await d.count();i++){const item=d.nth(i),s=item.locator(':scope > summary');const q=await s.innerText(),was=await item.evaluate(e=>e.open);await s.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));const hit=await s.evaluate(e=>{const r=e.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {covered:!!t&&!e.contains(t),hit:t?.tagName,cls:t?.className?.toString()?.slice(0,80),top:r.top,bottom:r.bottom}});try{await s.click({timeout:10000});const open=await item.evaluate(e=>e.open);await s.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await s.click({timeout:10000});const restore=await item.evaluate(e=>e.open);tests.push({q,hit,pass:open!==was&&restore===was})}catch(e){tests.push({q,hit,pass:false,error:e.message});await p.screenshot({path:out+'/lighting-fail-'+w+'-'+i+'.png',animations:'disabled'})}}
   rows.push({type:'lighting',w,tests,pass:tests.length===9&&tests.every(t=>t.pass)});
  }catch(e){rows.push({type:'lighting',w,pass:false,error:e.message})}
  for(const [pname,css] of [['cursor-test/','main > .bcq-detail{order:25;}'],['cursor-test/central.html','main > .bcq-detail{order:23;}'],['washing-machine-cleaning/','@media(max-width:720px){.hero__copy > .bcq-brief{order:2;}}']]){
   try{await p.goto(root+pname,{waitUntil:'domcontentloaded'});await p.evaluate(async()=>{if(document.fonts)await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2000))]);scrollTo(0,0)});const before=await view(p,w);await p.addStyleTag({content:css});const after=await view(p,w);await p.screenshot({path:out+'/'+pname.replace(/\//g,'_').replace('.html','')+'-'+w+'-preview.png',animations:'disabled'});const pass=after.h1.y<after.brief.y&&after.detail.y>after.h1.y&&after.detail.y<after.faq.y&&after.scroll<=w+1;rows.push({type:'layout-preview',page:pname,w,before,after,css,pass});
   }catch(e){rows.push({type:'layout-preview',page:pname,w,pass:false,error:e.message})}
  }
  await p.close();
 }
 // Read the old official public page without sending forms or entering administration.
 const p=await b.newPage({viewport:{width:1440,height:900}});
 await p.route('**/*',r=>{const u=r.request().url();return u.startsWith('https://bc-services.okinawa/')||u.startsWith('https://www.bc-services.okinawa/')?r.continue():r.abort()});
 try{const r=await p.goto('https://bc-services.okinawa/menu',{waitUntil:'domcontentloaded',timeout:30000});const info=await p.evaluate(()=>({title:document.title,lines:document.body.innerText.split('\n').map(s=>s.trim()).filter(s=>/保証|補償|それ以降|週間|クリーニング後/.test(s)).slice(0,25),serviceLinks:[...new Set([...document.querySelectorAll('a[href]')].map(a=>a.href).filter(u=>/\/menu\/\d+/.test(u)))].slice(0,8)}));rows.push({type:'old-site',url:p.url(),http:r.status(),...info,pass:r.ok()});for(const u of info.serviceLinks){try{const rr=await p.goto(u,{waitUntil:'domcontentloaded',timeout:15000});const lines=await p.evaluate(()=>document.body.innerText.split('\n').map(s=>s.trim()).filter(s=>/保証|補償|それ以降|週間|クリーニング後/.test(s)).slice(0,15));rows.push({type:'old-service',url:u,http:rr.status(),lines,pass:rr.ok()})}catch(e){rows.push({type:'old-service',url:u,pass:false,error:e.message})}}}catch(e){rows.push({type:'old-site',pass:false,error:e.message})}await p.close();
 }finally{await b.close()}
 fs.writeFileSync(out+'/recheck.json',JSON.stringify(rows,null,2));
 for(const r of rows)console.log('BCQ_RECHECK '+JSON.stringify(r));
 if(rows.some(r=>['complete','lighting','layout-preview'].includes(r.type)&&!r.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});