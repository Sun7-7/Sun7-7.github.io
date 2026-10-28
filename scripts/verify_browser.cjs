const { chromium }=require('playwright');
const fs=require('fs');const path=require('path');const assert=require('assert/strict');
const ROOT=process.cwd(),PACKET=path.resolve(process.env.REVIEW_PACKET_DIR || 'tmp/review');
const AXE=require.resolve('axe-core/axe.min.js');
const BASE=process.env.TEST_BASE_URL || 'http://127.0.0.1:8091';
const papers=JSON.parse(fs.readFileSync('data/publications.json','utf8'));
const core=['index','research','publications','about','cv'];
const sizes=[{width:1440,height:900},{width:1280,height:800},{width:768,height:1024},{width:390,height:844}];
fs.mkdirSync(path.join(PACKET,'screenshots'),{recursive:true});
fs.mkdirSync(path.join(PACKET,'logs'),{recursive:true});
const errors=[],results=[],accessibility=[],interactions=[];
function track(page){page.on('pageerror',e=>errors.push({type:'pageerror',message:e.message,url:page.url()}));page.on('console',m=>{if(m.type()==='error')errors.push({type:'console',message:m.text(),url:page.url()})});page.on('response',r=>{if(r.url().startsWith(BASE+'')&&r.status()>=400)errors.push({type:'http',status:r.status(),url:r.url()})});}
async function ready(page){await page.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});}
async function state(page){return page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length,brokenImages:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.getAttribute('src')),clippedText:[...document.querySelectorAll('h1,h2,h3,.authors,.publication-summary')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.tagName+':'+e.textContent.slice(0,40)),theme:document.documentElement.dataset.theme}));}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : process.platform==='win32' ? {channel:'msedge'} : {})});
 for(const size of sizes) for(const lang of ['zh','en']) for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:size,deviceScaleFactor:1});
  await context.addInitScript(value=>localStorage.setItem('theme',value),theme);
  const page=await context.newPage();track(page);
  for(const file of core){
   const url=`${BASE}/${lang==='en'?'en/':''}${file}.html`;
   await page.goto(url,{waitUntil:'networkidle'});await ready(page);
   const s=await state(page);assert.equal(s.width,s.scrollWidth,url);assert.equal(s.h1,1);assert.equal(s.theme,theme);assert.equal(s.brokenImages.length,0,url);assert.equal(s.clippedText.length,0,JSON.stringify(s));
   const scholar='https://scholar.google.com.hk/citations?user=pW8kkrsAAAAJ&hl=zh-CN';
   assert(await page.locator(`a[href="${scholar}"]`).count()>=1);
   if(file==='index'){
    assert((await page.locator('h1').innerText()).startsWith(lang==='zh'?'孙琦':'Qi Sun'));
    assert.equal(await page.locator('.selected-domain').count(),3);
    for(const area of ['learning','signals','device'])assert.equal(await page.locator(`[aria-labelledby=selected-${area}] [data-publication]`).count(),2);
    assert.equal(await page.locator('.selected-domains [data-publication]').count(),6);
   }
   if(file==='publications'){
    assert.equal(await page.locator('#all-publications-list [data-publication]').count(),11);
    assert.equal(await page.locator('#all-publications-list .publication-summary').count(),0);
    assert.equal(await page.locator('.selected-row time').count(),0);
   }
   if(file==='cv'){
    assert.equal(await page.locator('.cv-publications [data-publication]').count(),11);
    assert.equal(await page.locator('.publication-summary').count(),0);
   }
   if(file==='research'){
    assert.equal(await page.locator('.full-figure-link').count(),6);
    assert((await page.locator('#device img').first().getAttribute('src')).includes('high-k-trench-gan-hemt'));
    assert.deepEqual(await page.locator('.small-heading').allTextContents(),Array(3).fill(lang==='zh'?'已发表论文':'Published Papers'));
   }
   if(file==='about')assert.equal(await page.locator('h1').innerText(),lang==='zh'?'个人简介':'Biography');
   results.push({url,...size,theme,...s});
   if(size.width===1440||size.width===390){
    await page.addScriptTag({path:AXE});
    const a=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}});return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,failureSummary:n.failureSummary}))})),incomplete:r.incomplete.map(x=>({id:x.id,nodes:x.nodes.length})),passes:r.passes.length};});
    accessibility.push({url,width:size.width,theme,...a});
    const label=file==='index'?'home':file;
    await page.screenshot({path:path.join(PACKET,'screenshots',`${label}_${lang}_${size.width}x${size.height}_${theme}.png`),fullPage:false});
    if(theme==='light')await page.screenshot({path:path.join(PACKET,'screenshots',`${label}_${lang}_${size.width}x${size.height}_${theme}_full.png`),fullPage:true});
   }
  }
  await context.close();
 }
 // Every legacy paper route in both languages, desktop and mobile.
 for(const size of [sizes[0],sizes[3]]){
  const context=await browser.newContext({viewport:size});const page=await context.newPage();track(page);
  for(const lang of ['zh','en']) for(const p of papers){
   const url=`${BASE}/${lang==='en'?'en/':''}papers/${p.slug}.html`;
   await page.goto(url,{waitUntil:'networkidle'});await ready(page);const s=await state(page);
   assert.equal(s.scrollWidth,size.width,url);assert.equal(s.brokenImages.length,0,url);assert.equal(s.clippedText.length,0,JSON.stringify(s));results.push({url,...size,...s});
   const a=await page.locator('.paper-header .authors').innerText();const names=p.authors.map(x=>x.given+' '+x.family);const natural=names.slice(0,-1).join(', ')+', and '+names.at(-1)+'.';assert.equal(a,natural);assert.equal(a.split('Qi Sun').length-1,1);
   const expectedDateLabel=p.publisher_citation_publication_date?(lang==='zh'?'出版记录日期：':'Publication record:'):(lang==='zh'?'出版日期：':'Published:');
   assert((await page.locator('.publication-date').innerText()).startsWith(expectedDateLabel));
   if(p.publisher_citation_publication_date){assert.equal(p.date,'2026-09-29');assert.equal(p.online_publication_date,null);assert.equal(p.event_date.start,'2026-07-06');assert.equal(p.event_date.end,'2026-07-11');}
   assert.equal(await page.locator('.full-figure-link').count(),3);
   for(const credit of await page.locator('.figure-credit').allTextContents())assert.equal((credit.match(lang==='zh'?/图源：/g:/Source:/g)||[]).length,1);
   if(p.slug==='mte-ste-continuous-temporal-signal-classification'){
    await page.screenshot({path:path.join(PACKET,'screenshots',`paper_detail_${lang}_${size.width}x${size.height}_light_full.png`),fullPage:true});
    await page.addScriptTag({path:AXE});const r=await page.evaluate(async()=>{let r=await axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}});return {violations:r.violations,incomplete:r.incomplete.map(x=>({id:x.id,nodes:x.nodes.length})),passes:r.passes.length}});accessibility.push({url,width:size.width,theme:'light',...r});
   }
  }await context.close();
 }
 // Native keyboard interactions and combined filters, including an empty intersection.
 const context=await browser.newContext({viewport:sizes[3],colorScheme:'dark'});const page=await context.newPage();track(page);
 await page.goto(BASE+'/publications.html');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('href'),'#main');await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'main');
 const menu=page.locator('.menu-toggle');await menu.focus();await page.keyboard.press('Enter');assert.equal(await menu.getAttribute('aria-expanded'),'true');
 await page.screenshot({path:path.join(PACKET,'screenshots','mobile_menu_390x844.png')});
 await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');assert(await menu.evaluate(e=>e===document.activeElement));
 const theme=page.locator('.theme-toggle');await theme.focus();await page.keyboard.press('Space');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(await theme.getAttribute('aria-pressed'),'true');
 await page.locator('.language-switch').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(await page.locator('body').getAttribute('data-lang'),'en');
 const counts=[];
 for(const kind of ['all','conference','journal'])for(const area of ['all','learning','signals','device']){
  await page.locator(`[data-filter-group=kind][data-filter=${kind}]`).click();
  await page.locator(`[data-filter-group=area][data-filter=${area}]`).click();
  const expected=papers.filter(p=>(kind==='all'||p.kind===kind)&&(area==='all'||p.area===area)).length;
  const actual=await page.locator('#all-publications-list [data-publication]:visible').count();assert.equal(actual,expected);
  assert.equal(await page.locator('[data-filter-empty]').isVisible(),expected===0);
  for(const group of await page.locator('[data-year-group]').all()){
   const visibleRows=await group.locator('[data-publication]:visible').count();
   assert.equal(await group.isVisible(),visibleRows>0);
  }
  counts.push({kind,area,expected,actual});
 }
 await page.locator('[data-filter-group=kind][data-filter=conference]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator(':focus').getAttribute('data-filter'),'journal');assert.equal(await page.locator(':focus').getAttribute('aria-pressed'),'true');
 await page.locator('[data-filter-group=area][data-filter=device]').focus();await page.keyboard.press('Home');assert.equal(await page.locator(':focus').getAttribute('data-filter'),'all');
 interactions.push({name:'keyboard_menu_escape_theme_language_combined_filters',status:'PASS',counts});
 for(const lang of ['','en/'])for(const p of ['snn-surrogate-function-notes','radar-temporal-encoding','spiking-som-deinterleaving','ml-device-modeling']){
  await page.goto(`${BASE}/${lang}post.html?slug=${p}`);await page.waitForURL(`**/${lang}notes/${p}.html`);assert.equal(await page.locator('h1').count(),1);
 }
 await page.goto(BASE+'/index.html#featured-publications');assert(await page.locator('#featured-publications').count());
 await page.goto(BASE+'/research.html');await page.locator('.full-figure-link').first().focus();
 const popupPromise=page.waitForEvent('popup');await page.keyboard.press('Enter');const popup=await popupPromise;
 await popup.waitForLoadState('domcontentloaded');assert(popup.url().endsWith('.png'));assert(await popup.locator('img').evaluate(i=>i.naturalWidth>1000));await popup.close();
 interactions.push({name:'keyboard_full_size_original_figure',status:'PASS'});
 await context.close();
 // No-JavaScript readability is tested, including mobile navigation and all papers.
 for(const lang of ['','en/']){
  const context=await browser.newContext({viewport:sizes[3],javaScriptEnabled:false});const page=await context.newPage();
  for(const file of core){await page.goto(`${BASE}/${lang}${file}.html`);assert.equal(await page.locator('h1').count(),1);const w=await page.evaluate(()=>document.documentElement.scrollWidth);assert.equal(w,390);if(file==='publications')assert.equal(await page.locator('#all-publications-list [data-publication]').count(),11);}
  interactions.push({name:'no_javascript_'+(lang?'en':'zh'),status:'PASS'});await context.close();
 }
 const printContext=await browser.newContext({viewport:sizes[0]});const printPage=await printContext.newPage();
 for(const lang of ['','en/']){await printPage.goto(`${BASE}/${lang}cv.html`);await printPage.emulateMedia({media:'print'});await printPage.pdf({path:path.join(PACKET,'logs',`public_cv_${lang?'en':'zh'}_print_test.pdf`),format:'A4',printBackground:true,margin:{top:'14mm',bottom:'14mm',left:'16mm',right:'16mm'}});}
 await printPage.emulateMedia({reducedMotion:'reduce',media:'screen'});await printPage.goto(BASE+'/index.html');
 assert.equal(await printPage.locator('canvas').count(),0);assert.equal(await printPage.evaluate(()=>document.getAnimations().length),0);interactions.push({name:'printable_public_cv_and_reduced_motion',status:'PASS'});
 await printContext.close();await browser.close();
 const report={scenes:results.length,results,interactions,errors};
 fs.writeFileSync(path.join(PACKET,'logs/browser_checks.json'),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(PACKET,'logs/accessibility_axe.json'),JSON.stringify(accessibility,null,2));
 fs.writeFileSync(path.join(PACKET,'logs/console.log'),errors.length?JSON.stringify(errors,null,2):'No browser console errors, page exceptions or failing local resource responses were observed.\n');
 console.log(JSON.stringify({scenes:results.length,axeScenes:accessibility.length,axeViolations:accessibility.reduce((n,x)=>n+x.violations.length,0),errors:errors.length,interactionGroups:interactions.length}));
 assert.equal(errors.length,0);assert.equal(accessibility.reduce((n,x)=>n+x.violations.length,0),0);
})().catch(e=>{console.error(e);process.exit(1)});
