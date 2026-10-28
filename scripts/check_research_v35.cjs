const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium,firefox,webkit}=require('playwright');
const BASE=process.env.TEST_BASE_URL||'http://127.0.0.1:8095',OUT=path.resolve(process.env.REVIEW_PACKET_DIR||'tmp/v35');
fs.mkdirSync(OUT+'/screenshots',{recursive:true});fs.mkdirSync(OUT+'/logs',{recursive:true});
const mapping=JSON.parse(fs.readFileSync('data/research_visuals.json','utf8')).sections;
const details=Object.fromEntries(JSON.parse(fs.readFileSync('data/publication_details.json','utf8')).map(p=>[p.slug,p]));
const figs=Object.fromEntries(JSON.parse(fs.readFileSync('data/figures.json','utf8')).map(f=>[f.id,f]));
function sources(m,lang){return m.figureRefs.map(ref=>{const f=figs[ref];return (lang==='en'?'../':'')+details[f.publication_slug].visuals[f.visual_index].src;});}
const all=[],errors=[],axe=[],scenes=[],availability=[];
async function waitStage(area,slug){await area.page().waitForFunction(([id,slug])=>document.querySelector('#'+id+' .stage-content').dataset.stageSlug===slug&&!document.querySelector('#'+id+' .preview-stage').hasAttribute('aria-busy'),[await area.getAttribute('id'),slug]);}
async function ready(page){await page.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});}
async function shot(page,name,state){await page.screenshot({path:OUT+'/screenshots/'+name+'.png',fullPage:false});scenes.push({file:name+'.png',url:page.url(),viewport:page.viewportSize(),state,environment:'local V3.5 candidate'});}
async function scan(page,info){await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const result=await page.evaluate(async()=>{const r=await axe.run();return {violations:r.violations,incomplete:r.incomplete.map(x=>({id:x.id,nodes:x.nodes.length}))};});axe.push({...info,...result});assert.equal(result.violations.length,0,JSON.stringify(result.violations));}
async function engine(name,type){
 let browser;
 try{browser=await type.launch({headless:true,...(name==='edge'?{channel:'msedge'}:{})});availability.push({name,available:true});}
 catch(e){availability.push({name,available:false,error:e.message});return;}
 try{
 for(const width of [1440,1280,768,390,320])for(const lang of ['zh','en'])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:width===320?700:width===768?1024:width===1280?800:width===1440?900:844},hasTouch:width<960});
  await context.addInitScript(v=>localStorage.setItem('theme',v),theme);
  await context.addInitScript(()=>{window.__scrollCalls=[];for(const k of ['scrollBy','scrollTo']){const old=window[k];window[k]=function(...a){__scrollCalls.push({method:k,args:a});return old.apply(this,a);};}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push({name,width,lang,theme,error:e.message}));
  await page.goto(`${BASE}/${lang==='en'?'en/':''}research.html`,{waitUntil:'networkidle'});await ready(page);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  assert.equal(await page.locator('.research-paper').count(),9);
  if([1440,390,320].includes(width)&&name==='edge')await shot(page,`research_${name}_${lang}_${width}_${theme}_overview`,'overview');
  for(const section of mapping){
   const area=page.locator('#'+section.id),stage=area.locator('.stage-content');
   if(width>=960){
    for(const m of section.previews){
     const row=area.locator(`[data-preview-slug="${m.slug}"]`);await row.scrollIntoViewIfNeeded();
     const before=await page.evaluate(()=>({scrollY,height:document.documentElement.scrollHeight}));
     await row.hover({position:{x:5,y:12}});await waitStage(area,m.slug);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),before.height);
     assert.equal(await page.evaluate(()=>scrollY),before.scrollY);
     assert.deepEqual(await stage.locator('img').evaluateAll(imgs=>imgs.map(i=>i.getAttribute('src'))),sources(m,lang));
     all.push({name,width,lang,theme,slug:m.slug,mode:'whole-row preview',passed:true});
    }
    const first=area.locator('.research-paper').first(),last=area.locator('.research-paper').last();
    await first.locator('.pin-preview').click();await waitStage(area,section.previews[0].slug);assert.equal(await first.locator('.pin-preview').getAttribute('aria-pressed'),'true');
    await last.hover();await page.waitForTimeout(180);assert.equal(await stage.getAttribute('data-stage-slug'),section.previews[0].slug);
    await first.locator('.pin-preview').click();await last.hover();await waitStage(area,section.previews.at(-1).slug);
    await last.locator('.pin-preview').focus();await page.keyboard.press('Escape');await waitStage(area,'overview');
    await first.locator('.research-paper-title').focus();await waitStage(area,section.previews[0].slug);
    await page.keyboard.press('Tab');assert(await first.locator('.pin-preview').evaluate(e=>e===document.activeElement));await page.keyboard.press('Shift+Tab');assert(await first.locator('.research-paper-title').evaluate(e=>e===document.activeElement));
   }
   const chosen=section.previews[0],row=area.locator('.research-paper').first(),read=row.locator('.preview-toggle');
   await read.click();const dialog=page.locator('#paper-reader');assert(await dialog.isVisible());assert.equal(await dialog.locator('img').count(),chosen.figureRefs.length);assert.deepEqual(await dialog.locator('img').evaluateAll(imgs=>imgs.map(i=>i.getAttribute('src'))),sources(chosen,lang));
   assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
   if(width===390&&name==='edge')await shot(page,`reader_${section.id}_${lang}_${width}_${theme}`,'explicit illustrated reader');
   if(section.id==='learning'&&[1440,390].includes(width))await scan(page,{name,width,lang,theme,state:'reader'});
   await page.keyboard.press('Escape');assert(!(await dialog.isVisible()));await read.page().waitForFunction(id=>document.activeElement===document.querySelector(`[data-preview-slug="${id}"] .preview-toggle`),chosen.slug);assert(await read.evaluate(e=>e===document.activeElement));
   await read.click();await dialog.locator('.dialog-close').click();await read.page().waitForFunction(id=>document.activeElement===document.querySelector(`[data-preview-slug="${id}"] .preview-toggle`),chosen.slug);assert(await read.evaluate(e=>e===document.activeElement));
   all.push({name,width,lang,theme,slug:chosen.slug,mode:'reader, close, Escape and focus return',passed:true});
  }
  assert.equal(await page.evaluate(()=>__scrollCalls.length),0,'Application must not scroll the window');
  if([1440,390].includes(width))await scan(page,{name,width,lang,theme,state:'default'});
  await context.close();
 }
 for(const lang of ['zh','en']){const p=await browser.newPage({javaScriptEnabled:false,viewport:{width:320,height:700}});await p.goto(`${BASE}/${lang==='en'?'en/':''}research.html`);assert.equal(await p.locator('.research-paper-title:visible').count(),9);assert.equal(await p.locator('.preview-stage img:visible').count(),6);assert.equal(await p.locator('.preview-toggle:visible').count(),0);await p.close();}
 }finally{await browser.close();}
}
(async()=>{
 const results=await Promise.allSettled([engine('edge',chromium),engine('firefox',firefox),engine('webkit',webkit)]);
 for(let i=0;i<results.length;i++)if(results[i].status==='rejected')errors.push({engine:['edge','firefox','webkit'][i],error:results[i].reason.stack});
 fs.writeFileSync(OUT+'/logs/research_checks.json',JSON.stringify({checks:all,availability,axe,scenes,errors},null,2));
 console.log(JSON.stringify({checks:all.length,engines:availability,axeScans:axe.length,errors:errors.length}));assert.equal(errors.length,0,JSON.stringify(errors));
})().catch(e=>{console.error(e);process.exit(1)});
