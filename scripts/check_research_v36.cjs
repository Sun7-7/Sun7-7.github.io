/* Actual-browser V3.6 candidate verification; raw data is written before failure. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium,webkit}=require('playwright');
const BASE=process.env.TEST_BASE_URL||'http://127.0.0.1:8096';
const OUT=path.resolve(process.env.REVIEW_PACKET_DIR||'tmp/v36');
fs.mkdirSync(OUT+'/screenshots',{recursive:true});fs.mkdirSync(OUT+'/logs',{recursive:true});
const mappings=JSON.parse(fs.readFileSync('data/research_visuals.json','utf8')).sections;
const publications=JSON.parse(fs.readFileSync('data/publications.json','utf8'));
const expectedCards=mappings.reduce((n,s)=>n+s.previews.length,0);
const expectedFigures=mappings.reduce((n,s)=>n+s.previews.reduce((total,p)=>total+p.figureRefs.length,0),0);
const sizes=[{width:1440,height:900},{width:1280,height:800},{width:1024,height:768},{width:390,height:844},{width:375,height:812}];
const report={environment:{base:BASE,date:new Date().toISOString()},scenes:[],cards:[],hover:[],dialogs:[],regression:[],axe:[],stress:[],errors:[],engines:[]};
function track(p){p.on('pageerror',e=>report.errors.push({type:'pageerror',message:e.message}));p.on('console',m=>{if(m.type()==='error')report.errors.push({type:'console',message:m.text()});});}
async function settle(p,time=450){await p.waitForTimeout(time);}
async function ready(p){await p.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});}
async function shot(p,name){await p.screenshot({path:OUT+'/screenshots/'+name+'.png'});report.scenes.push({file:name+'.png',url:p.url(),viewport:p.viewportSize(),theme:await p.locator('html').getAttribute('data-theme')});}
async function state(j){return j.evaluate(e=>{const active=e.querySelector('.is-active'),panel=active?.querySelector('.paper-body');return {mode:e.dataset.mode,index:Number(e.dataset.activeIndex),y:scrollY,documentHeight:document.documentElement.scrollHeight,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,panelHeight:panel?.clientHeight,contentHeight:panel?.querySelector('.paper-detail').scrollHeight,headers:[...e.querySelectorAll('.paper-trigger')].map(h=>({height:h.clientHeight,scrollHeight:h.scrollHeight,cardHeight:h.closest('.focus-paper').clientHeight})),figures:active?[...active.querySelectorAll('.focus-figure')].map(f=>({ref:f.dataset.figureRef,src:f.querySelector('img').getAttribute('src'),loaded:f.querySelector('img').naturalWidth>0,contain:getComputedStyle(f.querySelector('img')).objectFit==='contain'})):[]};});}
async function position(j,index){await j.evaluate((e,i)=>{window.__qa=true;const start=e.getBoundingClientRect().top+scrollY-24,travel=e.offsetHeight-e.querySelector('.focus-stage').offsetHeight;scrollTo(0,start+travel*i/Math.max(1,Number(e.dataset.count)-1));window.__qa=false;},index);await settle(j.page());}
async function select(j,index){
 if(await j.getAttribute('data-mode')==='scroll')await position(j,index);
 else {if(Number(await j.getAttribute('data-active-index'))!==index)await j.locator('.paper-trigger').nth(index).click();await settle(j.page(),220);}
 assert.equal(Number(await j.getAttribute('data-active-index')),index);
}
async function axe(p,label){await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const r=await p.evaluate(async()=>{const r=await window.axe.run();return {violations:r.violations,incomplete:r.incomplete.map(i=>({id:i.id,nodes:i.nodes.length}))};});report.axe.push({label,...r});assert.equal(r.violations.length,0,JSON.stringify(r.violations));}
async function matrix(){
 const b=await chromium.launch({channel:'msedge',headless:true});report.engines.push({engine:'Edge Chromium',version:b.version(),available:true});
 try{for(const size of sizes)for(const lang of ['zh','en'])for(const theme of ['light','dark']){
  const key=`${size.width}-${lang}-${theme}`,c=await b.newContext({viewport:size,hasTouch:size.width<960,isMobile:size.width<960});await c.addInitScript(t=>localStorage.setItem('theme',t),theme);
  const p=await c.newPage();track(p);await p.goto(`${BASE}/${lang==='en'?'en/':''}research.html`);await ready(p);
  assert.equal(await p.locator('.focus-paper').count(),expectedCards);
  for(const mapping of mappings){
   const j=p.locator('#'+mapping.id+' .focus-journey');
   for(let i=0;i<mapping.previews.length;i++){
    await select(j,i);const s=await state(j);report.cards.push({key,area:mapping.id,paper:mapping.previews[i].slug,...s});
    assert.equal(s.width,s.scrollWidth,key);assert(s.figures.every(f=>f.loaded&&f.contain));
    assert.deepEqual(s.figures.map(f=>f.ref),mapping.previews[i].figureRefs);
    assert(s.headers.every(h=>h.scrollHeight<=h.height+2),JSON.stringify({key,area:mapping.id,i,headers:s.headers}));
    assert(s.headers.every(h=>h.height<=h.cardHeight+2),'Header extends outside its card: '+JSON.stringify({key,area:mapping.id,i,headers:s.headers}));
    if(s.mode==='scroll')assert(s.contentHeight<=s.panelHeight+2,JSON.stringify({key,area:mapping.id,i,s}));
    const trigger=j.locator('.paper-trigger').nth(i);assert.equal(await trigger.getAttribute('aria-expanded'),'true');
    if(mapping.id==='learning'||i===0||i===mapping.previews.length-1)await shot(p,`${key}-${mapping.id}-p${i+1}`);
    const zoom=j.locator('.is-active .figure-zoom').first();await zoom.click();assert(await p.locator('#figure-viewer').evaluate(d=>d.open));
    assert.equal(await p.locator('#figure-viewer .viewer-image img').getAttribute('src'),s.figures[0].src);
    if(i===0&&mapping.id==='learning')await shot(p,`${key}-figure-viewer`);
    await p.keyboard.press('Escape');await settle(p,40);assert.equal(await zoom.evaluate(e=>e===document.activeElement),true);
    report.dialogs.push({key,area:mapping.id,index:i,escape:true,focusReturned:true});
    // Resume position control after returning from the protected reader link.
    await p.evaluate(()=>document.activeElement.blur());
   }
  }
  await axe(p,key+'-research');
  for(const file of ['index','about','publications','cv']){
   await p.goto(`${BASE}/${lang==='en'?'en/':''}${file}.html`);await ready(p);
   assert.equal(await p.locator('h1').count(),1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),size.width);
   assert(await p.locator('a[href*="pW8kkrsAAAAJ"]').count()>0);
   if(file==='index')assert.equal(await p.locator('.home-work').count(),6);
   if(file==='publications'){
    assert.equal(await p.locator('#all-publications-list [data-publication]').count(),publications.length);
    await p.locator('[data-filter-group="area"][data-filter="learning"]').click();assert.equal(await p.locator('#all-publications-list [data-publication]:visible').count(),publications.filter(p=>p.area==='learning').length);
    await p.locator('[data-filter-group="kind"][data-filter="conference"]').click();assert.equal(await p.locator('#all-publications-list [data-publication]:visible').count(),publications.filter(p=>p.area==='learning'&&p.kind==='conference').length);
   }
   report.regression.push({key,page:file,passed:true});
   if(['index','about'].includes(file))await shot(p,key+'-'+file);
   if(size.width===1440&&['index','about'].includes(file))await axe(p,key+'-'+file);
  }
  await c.close();
 }}finally{await b.close();}
}
async function interaction(){
 const b=await chromium.launch({channel:'msedge',headless:true});const c=await b.newContext({viewport:{width:1440,height:900}});
 if(!report.engines.some(e=>e.engine==='Edge Chromium'))report.engines.push({engine:'Edge Chromium',version:b.version(),available:true});
 await c.addInitScript(()=>{
  window.__appScroll=[];for(const method of ['scrollTo','scrollBy']){const old=window[method];window[method]=function(...args){if(!window.__qa)window.__appScroll.push({method,args,y:scrollY});return old.apply(this,args);};}
  window.__focusEvents=[];document.addEventListener('researchfocuschange',e=>window.__focusEvents.push({...e.detail,y:scrollY,height:document.documentElement.scrollHeight,time:performance.now()}));
  window.__longTasks=[];try{new PerformanceObserver(list=>window.__longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});}catch{}
 });
 const p=await c.newPage();track(p);await p.goto(BASE+'/research.html');await ready(p);await p.mouse.move(3,3);
 const j=p.locator('#learning .focus-journey');await position(j,0);const before=await state(j);
 await p.mouse.wheel(0,540);await settle(p,500);assert.equal(Number(await j.getAttribute('data-active-index')),1);
 await p.mouse.wheel(0,540);await settle(p,500);assert.equal(Number(await j.getAttribute('data-active-index')),2);
 await p.mouse.wheel(0,-1080);await settle(p,500);assert.equal(Number(await j.getAttribute('data-active-index')),0);
 assert.equal((await state(j)).documentHeight,before.documentHeight);
 assert.equal((await p.evaluate(()=>window.__appScroll)).length,0,'Natural wheel caused programmatic scroll');
 report.stress.push({name:'natural_wheel_forward_reverse',passed:true,before,after:await state(j)});
 for(const mapping of mappings){const area=p.locator('#'+mapping.id+' .focus-journey');await position(area,0);
  for(let i=1;i<mapping.previews.length;i++)for(const zone of ['blank','venue','title']){
   await position(area,0);await p.mouse.move(2,2);await settle(p,250);
   const count=await p.evaluate(()=>window.__appScroll.length),a=await state(area);const row=area.locator('.focus-paper').nth(i),box=await row.boundingBox();
   if(zone==='blank')await p.mouse.move(box.x+box.width-30,box.y+box.height/2);else await row.locator(zone==='venue'?'.venue':'.paper-short').hover();
   await settle(p,550);assert.equal(Number(await area.getAttribute('data-active-index')),i);const h=await state(area);assert.equal(h.y,a.y);assert.equal(h.documentHeight,a.documentHeight);assert.equal(await p.evaluate(()=>window.__appScroll.length),count);
   await p.mouse.move(2,2);await settle(p,500);assert.equal(Number(await area.getAttribute('data-active-index')),0);
   report.hover.push({area:mapping.id,index:i,zone,before:a,after:h,restored:true});
  }
 }
 await position(j,0);for(let i=0;i<12;i++){await p.mouse.wheel(0,i%2?-720:720);await settle(p,50);}await settle(p,500);assert.equal((await state(j)).documentHeight,before.documentHeight);
 report.stress.push({name:'rapid_reverse_12',passed:true,state:await state(j)});
 await position(j,0);for(let i=0;i<10;i++){const box=await j.locator('.focus-paper').nth(1).boundingBox();await p.mouse.move(box.x+box.width-30,box.y+box.height/2);await settle(p,140);await p.mouse.move(2,2);await settle(p,160);}await settle(p);assert.equal((await state(j)).documentHeight,before.documentHeight);
 report.stress.push({name:'repeated_hover_leave_10',passed:true,state:await state(j)});
 await j.locator('.paper-trigger').nth(2).click();await settle(p,1100);assert.equal(Number(await j.getAttribute('data-active-index')),2);
 await j.locator('.paper-trigger').nth(2).focus();await p.keyboard.press('ArrowUp');await settle(p,1100);assert.equal(Number(await j.getAttribute('data-active-index')),1);
 await p.keyboard.press('Home');await settle(p,1100);assert.equal(Number(await j.getAttribute('data-active-index')),0);
 await p.keyboard.press('End');await settle(p,1100);assert.equal(Number(await j.getAttribute('data-active-index')),2);
 await p.keyboard.press('Enter');await settle(p,1000);assert.equal(Number(await j.getAttribute('data-active-index')),2);
 await p.keyboard.press('Space');await settle(p,1000);assert.equal(Number(await j.getAttribute('data-active-index')),2);
 report.stress.push({name:'click_arrows_home_end_enter_space',passed:true,focus:await p.evaluate(()=>document.activeElement.id)});
 await p.emulateMedia({reducedMotion:'reduce'});await j.locator('.paper-trigger').first().click();await settle(p,100);assert.equal(Number(await j.getAttribute('data-active-index')),0);
 assert.equal(await p.locator('.focus-deck').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
 report.stress.push({name:'reduced_motion',passed:true});
 await p.setViewportSize({width:720,height:450});await settle(p);assert.equal(await j.getAttribute('data-mode'),'manual');assert.equal(await j.locator('.focus-stage').evaluate(e=>getComputedStyle(e).position),'static');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),720);report.stress.push({name:'200_percent_layout_equivalent_720x450',passed:true,nativeZoom:false});
 for(const size of [{width:320,height:700},{width:375,height:812}]){await p.setViewportSize(size);await settle(p);for(let i=0;i<3;i++){await select(j,i);assert.equal((await state(j)).scrollWidth,size.width);}await shot(p,`${size.width}-narrow-manual`);}
 report.stress.push({name:'narrow_manual_clicks',passed:true});
 report.eventsBeforeReload=await p.evaluate(()=>({focus:window.__focusEvents,appScroll:window.__appScroll,longTasks:window.__longTasks}));
 await p.reload();await p.setViewportSize({width:1440,height:900});await settle(p);await position(j,1);await p.goto(BASE+'/about.html');await p.goBack();await settle(p,650);assert.equal(Number(await j.getAttribute('data-active-index')),1);report.stress.push({name:'history_restoration',passed:true});
 report.events=await p.evaluate(()=>({focus:window.__focusEvents,appScroll:window.__appScroll,longTasks:window.__longTasks}));
 await c.close();
 // Progressive fallback is tested with every script disabled, not a CSS class edit.
 for(const width of [1440,375]){const c=await b.newContext({viewport:{width,height:900},javaScriptEnabled:false}),p=await c.newPage();await p.goto(BASE+'/research.html');assert.equal(await p.locator('.focus-paper').count(),expectedCards);assert.equal(await p.locator('.paper-body:visible').count(),expectedCards);assert.equal(await p.locator('.figure-zoom:visible').count(),expectedFigures);report.stress.push({name:'no_js_'+width,passed:true});await c.close();}
 await b.close();
 // Independent engine smoke test; unavailable engines are explicitly recorded.
 let wb;try{wb=await webkit.launch({headless:true});report.engines.push({engine:'Playwright WebKit (Windows; not physical Safari)',version:wb.version(),available:true});}catch(e){report.engines.push({engine:'WebKit',available:false,error:e.message});}
 if(wb){try{const p=await wb.newPage({viewport:{width:1280,height:800}});track(p);await p.goto(BASE+'/en/research.html');const j=p.locator('#learning .focus-journey');await select(j,1);await j.locator('.is-active .figure-zoom').first().click();await p.keyboard.press('Escape');assert(await j.locator('.is-active .figure-zoom').first().evaluate(e=>e===document.activeElement));report.stress.push({name:'webkit_position_dialog',passed:true});}finally{await wb.close();}}
}
(async()=>{try{if(process.env.RESEARCH_STRESS_ONLY==='1'){const previous=JSON.parse(fs.readFileSync(OUT+'/logs/browser_checks.json','utf8'));for(const key of ['cards','dialogs','regression','axe','scenes','environment'])report[key]=previous[key];}else await matrix();await interaction();assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.passed=true;}catch(e){report.passed=false;report.errors.push({type:'assertion',message:e.stack});process.exitCode=1;}finally{report.scenes=[...new Map(report.scenes.map(s=>[s.file,s])).values()];fs.writeFileSync(OUT+'/logs/browser_checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cards:report.cards.length,dialogs:report.dialogs.length,hover:report.hover.length,regression:report.regression.length,axe:report.axe.length,screenshots:report.scenes.length,stress:report.stress.length,errors:report.errors}));}})();
