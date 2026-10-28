const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const out=path.resolve(process.env.REVIEW_PACKET_DIR||'tmp/v34-inline'),base=process.env.TEST_BASE_URL||'http://127.0.0.1:8094';
fs.mkdirSync(out+'/screenshots',{recursive:true});fs.mkdirSync(out+'/logs',{recursive:true});
const mapping=JSON.parse(fs.readFileSync('data/research_visuals.json','utf8'));
const checks=[],scenes=[],axeResults=[],errors=[];
async function ready(p){await p.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});}
async function settled(area){await area.evaluate(el=>new Promise(resolve=>{function poll(){if(!el.hasAttribute('data-transitioning'))resolve();else requestAnimationFrame(poll);}poll();}));}
async function capture(p,name,state,fullPage=false){await p.screenshot({path:out+'/screenshots/'+name+'.png',fullPage});scenes.push({file:name+'.png',state,url:p.url(),viewport:p.viewportSize(),environment:'local candidate',theme:await p.locator('html').getAttribute('data-theme')});}
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 for(const width of [1440,1280,768,390,375])for(const lang of ['zh','en'])for(const theme of ['light','dark']){
  const p=await b.newPage({viewport:{width,height:width===768?1024:width>900?900:844},hasTouch:width<=768,isMobile:width<500});
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.addInitScript(v=>localStorage.setItem('theme',v),theme);
  await p.goto(`${base}/${lang==='en'?'en/':''}research.html`);await ready(p);
  assert.equal(await p.locator('.research-theme > .research-figure-pair:visible').count(),3);
  assert.equal(await p.locator('.paper-preview:visible').count(),0);
  if([1440,390].includes(width))await capture(p,`default_${lang}_${width}_${theme}`,'overview',true);
  for(const section of mapping.sections){
   const area=p.locator('#'+section.id),overview=area.locator(':scope > .research-figure-pair');
   for(const [i,m] of section.previews.entries()){
    const row=area.locator(`[data-preview-slug="${m.slug}"]`),title=row.locator('.research-paper-title'),panel=row.locator('.paper-preview'),btn=row.locator('.preview-toggle');
    await title.scrollIntoViewIfNeeded();const before=(await title.boundingBox()).y;
    if(width>900){await title.hover();await p.waitForTimeout(150);}else await btn.tap();
    await settled(area);
    assert(await panel.isVisible());assert(!(await overview.isVisible()));assert.equal(await area.locator('.paper-preview:visible').count(),1);
    assert.equal(await panel.locator('img').count(),2);assert.equal(await btn.getAttribute('aria-expanded'),'true');
    assert.deepEqual(await panel.locator('img').evaluateAll(imgs=>imgs.map(i=>i.getAttribute('src'))),m.figures.map(src=>(lang==='en'?'../':'')+src));
    const titleBox=await title.boundingBox(),box=await panel.boundingBox();assert(box.y>=titleBox.y+titleBox.height,'panel must follow title');assert.equal(Math.round(box.width),Math.round((await area.boundingBox()).width));
    if(width>900)assert(Math.abs(titleBox.y-before)<3,'title must stay anchored while overview folds');
    await p.mouse.move(1,1);await p.waitForTimeout(180);assert(await panel.isVisible(),'selection persists while reading');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
    if(i===0 && [1440,390].includes(width)){await panel.scrollIntoViewIfNeeded();await capture(p,`expanded_${section.id}_${lang}_${width}_${theme}`,'two-figure inline selection');}
    checks.push({slug:m.slug,lang,width,theme,figures:m.figures,passed:true});
   }
   const row=area.locator('.research-paper').last(),title=row.locator('.research-paper-title'),btn=row.locator('.preview-toggle');
   await btn.click();await settled(area);assert(await overview.isVisible());assert.equal(await area.locator('.paper-preview:visible').count(),0);
   await title.focus();await settled(area);assert(!(await overview.isVisible()));await p.keyboard.press('Tab');assert(await btn.evaluate(e=>e===document.activeElement));await p.keyboard.press('Tab');assert(await row.locator('.paper-preview a').first().evaluate(e=>e===document.activeElement));
   await p.keyboard.press('Escape');await settled(area);assert(await overview.isVisible());assert(await btn.evaluate(e=>e===document.activeElement));
   await btn.press('Space');await settled(area);assert(await row.locator('.paper-preview').isVisible());await row.locator('.preview-close').click();await settled(area);assert(await overview.isVisible());assert(await btn.evaluate(e=>e===document.activeElement));
  }
  await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')});let ax=await p.evaluate(async()=>{let r=await axe.run();return {violations:r.violations,incomplete:r.incomplete.map(x=>x.id)};});axeResults.push({width,lang,theme,state:'default',...ax});assert.equal(ax.violations.length,0);
  await p.locator('.research-paper-title').first().focus();await settled(p.locator('#learning'));ax=await p.evaluate(async()=>{let r=await axe.run();return {violations:r.violations,incomplete:r.incomplete.map(x=>x.id)};});axeResults.push({width,lang,theme,state:'expanded',...ax});assert.equal(ax.violations.length,0);
  await p.close();
 }
 for(const lang of ['zh','en']){const p=await b.newPage({javaScriptEnabled:false,viewport:{width:375,height:812}});await p.goto(`${base}/${lang==='en'?'en/':''}research.html`);assert.equal(await p.locator('.research-theme > .research-figure-pair:visible img').count(),6);assert.equal(await p.locator('.research-paper-title:visible').count(),9);assert.equal(await p.locator('.preview-toggle:visible').count(),0);await p.close();}
 const p=await b.newPage({viewport:{width:720,height:450},reducedMotion:'reduce'});await p.goto(base+'/research.html');await p.locator('.preview-toggle').first().click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),720);assert.equal(await p.locator('.preview-toggle').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');await p.close();
 await b.close();assert.equal(errors.length,0,JSON.stringify(errors));
 fs.writeFileSync(out+'/logs/inline_checks.json',JSON.stringify({checks,scenes,axeResults,errors,noJS:'both languages, 375px',zoom:'720x450 CSS viewport approximation; native zoom not tested',reducedMotion:'passed'},null,2));console.log(JSON.stringify({paperChecks:checks.length,scenes:scenes.length,axeScans:axeResults.length,errors}));
})().catch(e=>{fs.writeFileSync(out+'/logs/failure.json',JSON.stringify({message:e.message,stack:e.stack,checks,scenes,errors},null,2));console.error(e);process.exit(1)});
