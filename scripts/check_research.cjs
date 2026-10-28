const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('playwright');
const out=path.resolve(process.env.REVIEW_PACKET_DIR||'tmp/v34');fs.mkdirSync(out+'/screenshots',{recursive:true});
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8094';
const mapping=JSON.parse(fs.readFileSync('data/research_visuals.json'));
const scenes=[],checks=[],errors=[],axeResults=[];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function ready(p){await p.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});}
async function shot(p,name,state){const file=name+'.png';await p.screenshot({path:out+'/screenshots/'+file,fullPage:false});scenes.push({file,version:'V3.4',url:p.url(),environment:'local candidate',viewport:p.viewportSize(),theme:await p.locator('html').getAttribute('data-theme'),state});}
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 for(const width of [1440,1280,768,390,375])for(const lang of ['zh','en'])for(const theme of ['light','dark']){
  const context=await b.newContext({viewport:{width,height:width===1440?900:width===1280?800:width===768?1024:width===390?844:812},hasTouch:width<=768,isMobile:width<500});
  await context.addInitScript(v=>localStorage.setItem('theme',v),theme);
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto(`${base}/${lang==='en'?'en/':''}research.html`);await ready(p);
  assert.equal(await p.locator('.research-figure-pair').count(),3);assert.equal(await p.locator('.research-figure-pair img').count(),6);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
  await shot(p,`research_${lang}_${width}_${theme}_default`,'default');
  for(const s of mapping.sections)for(const m of s.previews){
   const row=p.locator(`[data-preview-slug="${m.slug}"]`),panel=row.locator('.paper-preview'),title=row.locator('.research-paper-title'),button=row.locator('button');
   await row.scrollIntoViewIfNeeded();
   if(width>900){
    await title.hover();await p.waitForTimeout(150);assert(await panel.isVisible());
    assert.equal(await row.locator('.paper-preview img').getAttribute('src'),(lang==='en'?'../':'')+m.src);
    const rb=await title.boundingBox(),pb=await panel.boundingBox();assert(pb.x>=rb.x+rb.width,`overlap ${m.slug}`);assert(pb.x+pb.width<=width+1);assert(pb.y>=-1&&pb.y+pb.height<=p.viewportSize().height+1,JSON.stringify(pb));
    await panel.hover();await p.waitForTimeout(250);assert(await panel.isVisible(),'hover must persist on preview');
    await p.mouse.move(1,1);await p.waitForTimeout(240);assert(!(await panel.isVisible()));
    await title.focus();assert(await panel.isVisible());await p.keyboard.press('Tab');assert.equal(await button.evaluate(e=>e===document.activeElement),true);
    await p.keyboard.press('Tab');assert.equal(await panel.locator('.preview-original').evaluate(e=>e===document.activeElement),true);
    await p.keyboard.press('Shift+Tab');assert.equal(await button.evaluate(e=>e===document.activeElement),true);
    await p.keyboard.press('Escape');assert(!(await panel.isVisible()));assert(await title.evaluate(e=>e===document.activeElement));
    await button.focus();await p.keyboard.press('Space');assert(await panel.isVisible());
   }else{await button.tap();assert(await panel.isVisible());assert.equal(await button.getAttribute('aria-expanded'),'true');}
   await panel.locator('img').evaluate(i=>i.decode());
   assert((await title.getAttribute('href')).includes(m.slug));
   if(width===1440||width===390)await shot(p,`preview_${lang}_${width}_${theme}_${m.slug}`,width>900?'focus-preview':'touch-expanded');
   checks.push({slug:m.slug,lang,theme,width,src:await panel.locator('img').getAttribute('src'),mode:width>900?'hover+focus+Tab+ShiftTab+Escape':'touch',passed:true});
   await button.click();assert(!(await panel.isVisible()));assert.equal(await button.getAttribute('aria-expanded'),'false');
  }
  await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const ax=await p.evaluate(async()=>{let r=await axe.run();return {violations:r.violations,incomplete:r.incomplete.map(x=>({id:x.id,impact:x.impact}))};});
  axeResults.push({lang,width,theme,...ax});assert.equal(ax.violations.length,0,JSON.stringify(ax.violations));
  await p.locator('.research-paper-title').first().focus();
  const axOpen=await p.evaluate(async()=>{let r=await axe.run();return {violations:r.violations,incomplete:r.incomplete.map(x=>({id:x.id,impact:x.impact}))};});
  axeResults.push({lang,width,theme,state:'focus',...axOpen});assert.equal(axOpen.violations.length,0);
  for(const file of ['index','about']){
   await p.goto(`${base}/${lang==='en'?'en/':''}${file}.html`);await ready(p);
   const portrait=p.locator(file==='index'?'.hero-portrait':'.about-portrait');
   const src=await portrait.getAttribute('src');assert(src.includes('?v=4b1c59727483'));
   const response=await p.request.get(new URL(src,p.url()).href),bytes=await response.body();
   const expected=fs.readFileSync(`assets/images/portraits/portrait_${file==='index'?'hero_4x5':'about_2x3'}.webp`);assert.equal(hash(bytes),hash(expected));
   checks.push({type:'portrait',file,lang,theme,width,sha256:hash(bytes),dimensions:await portrait.evaluate(e=>[e.naturalWidth,e.naturalHeight]),cacheVersion:src});
   if([1440,390].includes(width))await shot(p,`${file}_${lang}_${width}_${theme}`,'new portrait');
  }
  await context.close();
 }
 // No-JS reading and navigation at desktop and smallest viewport.
 for(const width of [1440,375])for(const lang of ['zh','en']){
  const p=await b.newPage({viewport:{width,height:900},javaScriptEnabled:false});await p.goto(`${base}/${lang==='en'?'en/':''}research.html`);
  assert.equal(await p.locator('.research-figure-pair img:visible').count(),6);assert.equal(await p.locator('.research-paper-title:visible').count(),9);assert.equal(await p.locator('.preview-toggle:visible').count(),0);
  await shot(p,`nojs_${lang}_${width}`,'javascript disabled');await p.close();
 }
 // 200% equivalent CSS viewport and reduced motion, outside-click, rapid switching, image failure fallback.
 const p=await b.newPage({viewport:{width:720,height:450},reducedMotion:'reduce'});await p.goto(base+'/research.html');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),720);
 assert.equal(await p.locator('.preview-toggle').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
 await p.locator('.preview-toggle').first().click();await p.locator('h1').click();assert.equal(await p.locator('.paper-preview:visible').count(),0);
 await p.setViewportSize({width:1440,height:900});
 const rows=p.locator('.research-paper');await rows.nth(0).hover();await rows.nth(1).hover();await p.waitForTimeout(160);assert.equal(await p.locator('.research-paper[data-active]').getAttribute('data-preview-slug'),'mpo-surrogate-function-snn');
 await p.route('**/*surrogate-mismatch.png*',r=>r.abort());
 await rows.nth(1).locator('img').evaluate(i=>{i.src=i.src+'?failure-test';});await p.waitForTimeout(200);assert(await rows.nth(1).locator('.preview-error').isVisible());
 checks.push({type:'edge-cases',rapidSwitch:true,outsideClose:true,reducedMotion:true,zoomEquivalentViewport:'720x450, equivalent to 1440x900 at 200%; native browser zoom not automated',imageFailureFallback:true});
 await p.close();await b.close();
 assert.equal(errors.length,0,JSON.stringify(errors));
 fs.writeFileSync(out+'/logs/v34_interactions.json',JSON.stringify({checks,scenes,axeResults,errors},null,2));
 console.log(JSON.stringify({interactionChecks:checks.filter(x=>x.slug).length,portraitChecks:checks.filter(x=>x.type==='portrait').length,scenes:scenes.length,axeScans:axeResults.length,errors}));
})().catch(e=>{fs.writeFileSync(out+'/logs/v34_failure.json',JSON.stringify({message:e.message,stack:e.stack,checks,scenes,errors},null,2));console.error(e);process.exit(1);});
