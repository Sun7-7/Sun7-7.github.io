const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.TEST_BASE_URL||'http://127.0.0.1:8097',OUT=path.resolve(process.env.REVIEW_PACKET_DIR||'tmp/v37');
fs.mkdirSync(OUT+'/screenshots',{recursive:true});fs.mkdirSync(OUT+'/logs',{recursive:true});
const maps=JSON.parse(fs.readFileSync('data/research_visuals.json','utf8')).sections;
const report={checks:[],axe:[],print:[],errors:[],scenes:[]};
const wait=(p,ms=450)=>p.waitForTimeout(ms);
async function state(stage){return stage.evaluate(e=>({index:e.dataset.primaryIndex,state:e.dataset.mediaState,y:scrollY,height:document.documentElement.scrollHeight,outer:e.closest('.focus-journey').dataset.activeIndex,tiles:[...e.querySelectorAll('figure')].map(f=>({ref:f.dataset.figureRef,w:f.getBoundingClientRect().width,h:f.getBoundingClientRect().height,scroll:f.scrollHeight,client:f.clientHeight,imgWidth:f.querySelector('img').naturalWidth,fit:getComputedStyle(f.querySelector('img')).objectFit}))}));}
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
for(const width of (process.env.MEDIA_WIDTHS||'1440,1280,390,375').split(',').map(Number))for(const lang of ['zh','en'])for(const theme of (process.env.MEDIA_THEMES||'light,dark').split(',')){
 const key=`${width}-${lang}-${theme}`,c=await b.newContext({viewport:{width,height:width===1440?900:width===1280?800:844},isMobile:width<700,hasTouch:width<700});
 await c.addInitScript(t=>localStorage.setItem('theme',t),theme);const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await p.goto(`${BASE}/${lang==='en'?'en/':''}research.html`);await p.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
 for(const mapping of maps){const j=p.locator('#'+mapping.id+' .focus-journey');for(let i=0;i<mapping.previews.length;i++){
  report.currentCase={key,slug:mapping.previews[i].slug};
  await p.mouse.move(2,2);await p.evaluate(()=>document.activeElement.blur());
  if(await j.getAttribute('data-mode')==='scroll')await j.evaluate((e,i)=>scrollTo(0,e.getBoundingClientRect().top+scrollY-24+(e.offsetHeight-e.querySelector('.focus-stage').offsetHeight)*i/(Number(e.dataset.count)-1)),i);
  else if(Number(await j.getAttribute('data-active-index'))!==i)await j.locator('.paper-trigger').nth(i).click();
  await wait(p);const row=j.locator('.focus-paper').nth(i),stage=row.locator('.focus-figures'),buttons=stage.locator('.figure-select');await stage.locator('.reset-figure').click();await p.evaluate(()=>document.activeElement.blur());await wait(p);
  const before=await state(stage),initial=Number(before.index),other=1-initial;
  if(width>=1100){await buttons.nth(other).hover();await wait(p);const h=await state(stage);assert.equal(Number(h.index),other);assert.equal(h.outer,before.outer);assert.equal(h.height,before.height);assert.equal(h.y,before.y);await p.mouse.move(2,2);await wait(p);assert.equal(Number((await state(stage)).index),initial);}
  await buttons.nth(other).click();await wait(p);const after=await state(stage);assert.equal(Number(after.index),other);assert.equal(after.state,'pinned');assert.equal(after.outer,before.outer);assert.equal(after.height,before.height);assert(after.tiles.every(t=>t.imgWidth>0&&t.fit==='contain'&&t.scroll<=t.client+2),JSON.stringify({key,slug:mapping.previews[i].slug,after}));
  await p.mouse.move(2,2);await wait(p,160);assert.equal((await state(stage)).index,String(other));
  if(i===0){const file=key+'-'+mapping.id+'-secondary-primary.png';await p.screenshot({path:OUT+'/screenshots/'+file});report.scenes.push({file,url:p.url(),viewport:p.viewportSize(),theme});}
  await buttons.nth(other).focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('Enter');await wait(p);assert.equal((await state(stage)).state,'pinned');
  await stage.locator('.reset-figure').click();await wait(p);assert.equal(Number((await state(stage)).index),initial);
  report.checks.push({key,slug:mapping.previews[i].slug,before,after,temporaryHover:width>=1100,pinned:true,keyboard:true,reset:true});
 }}
 await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const scan=await p.evaluate(async()=>{const r=await axe.run();return{violations:r.violations,incomplete:r.incomplete.map(i=>({id:i.id,nodes:i.nodes.length}))};});report.axe.push({key,...scan});assert.equal(scan.violations.length,0,JSON.stringify(scan.violations));
 if(width===1440&&theme==='light'){await p.emulateMedia({media:'print'});const visible=await p.locator('.focus-figure .figure-explainer:visible').count();assert.equal(visible,20);await p.pdf({path:OUT+'/screenshots/'+lang+'-research-print.pdf',format:'A4',printBackground:true});report.print.push({lang,allTwentyExplanationsVisible:true,realBrowserPdf:true});}
 await c.close();
}
// Explicit viewer on Home and every real paper, plus real 200/400% layout equivalents.
const c=await b.newContext({viewport:{width:1440,height:900}}),p=await c.newPage();
const pubs=JSON.parse(fs.readFileSync('data/publications.json','utf8'));
report.globalViewers=[];for(const lang of ['','en/'])for(const file of ['index.html',...pubs.map(p=>'papers/'+p.slug+'.html')]){
 await p.goto(BASE+'/'+lang+file);const link=p.locator('.media-open').first();assert(await link.count());await link.click();assert(await p.locator('#figure-viewer').evaluate(d=>d.open));await p.keyboard.press('Escape');await wait(p,40);assert(await link.evaluate(e=>e===document.activeElement));report.globalViewers.push({page:lang+file,passed:true});
}
report.zoom=[];for(const size of [{width:720,height:450},{width:360,height:225}]){await p.setViewportSize(size);await p.goto(BASE+'/en/research.html');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),size.width);assert.equal(await p.locator('.focus-journey').first().getAttribute('data-mode'),'manual');report.zoom.push({viewport:size,layoutEquivalentOnly:true,nativeMenuZoom:'NOT_TESTED'});}
await c.close();assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.passed=true;
}catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}finally{await b.close();fs.writeFileSync(OUT+'/logs/media_checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,axe:report.axe.length,viewers:report.globalViewers?.length,errors:report.errors}));}})();
