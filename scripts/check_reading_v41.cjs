const {chromium, firefox}=require('playwright');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const base='http://127.0.0.1:8101';
const out='tmp/v41';
const findings={checks:[],errors:[],intentionalErrors:[]};
const icml='mte-ste-continuous-temporal-signal-classification';
const source='https://raw.githubusercontent.com/mlresearch/v306/main/assets/sun26k/sun26k.pdf';
const delay=(p,n=250)=>p.waitForTimeout(n);
const shot=(p,n)=>p.screenshot({path:out+'/screenshots/'+n+'.png'});
const reader=p=>p.locator('.pdf-dialog');
const story=p=>p.locator('.story-dialog');
async function ready(p){
 await p.locator('.reader-status[data-state="ready"]').waitFor({state:'attached',timeout:25000});
 return p.frames().find(f=>f.url().includes('/viewer.html'));
}
async function openStory(p, opener){
 await opener.click();
 await story(p).locator('.paper-story').waitFor();
}
async function close(p, selector){
 const d=p.locator(selector);
 await d.locator('.reading-bar button').click();
 await d.waitFor({state:'detached'});
}
async function axe(p,name){
 await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const violations=await p.evaluate(async()=>(await axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})));
 findings.checks.push({name,violations});
 return violations;
}
function watch(p){
 p.on('pageerror',e=>findings.errors.push(e.message));
 p.on('console',m=>{if(m.type()==='error')findings.errors.push(m.text());});
}
async function run(){
 fs.mkdirSync(out+'/screenshots',{recursive:true});fs.mkdirSync(out+'/recordings',{recursive:true});
 const b=await chromium.launch({channel:'msedge'});
 try {
 const c=await b.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/recordings',size:{width:1440,height:900}},acceptDownloads:true});
 const p=await c.newPage();watch(p);
 const requested=[];p.on('request',r=>requested.push(r.url()));
 await p.goto(base+'/index.html');await shot(p,'desktop_zh_light_home');
 assert(!requested.some(x=>x.includes('/vendor/pdfjs/')));
 findings.checks.push({name:'initial lazy loading',pdfjsRequests:0,requests:requested.length});
 const opener=p.locator('a[data-story][href*="'+icml+'"]').first();await opener.scrollIntoViewIfNeeded();
 await delay(p,650);const y=await p.evaluate(()=>scrollY);
 await openStory(p,opener);await shot(p,'desktop_zh_light_story');
 const scroller=story(p).locator('.story-scroll');await scroller.evaluate(e=>e.scrollTop=360);
 const pdf=story(p).locator('[data-pdf]').first();
 await pdf.focus();await scroller.evaluate(e=>e.scrollTop=180);
 const before=await scroller.evaluate(e=>e.scrollTop);
 await pdf.evaluate(e=>e.click());
 const f=await ready(p);
 assert.equal(await f.evaluate(()=>PDFViewerApplication.pagesCount),20);
 await f.locator('#next').click();assert.equal(await f.locator('#pageNumber').inputValue(),'2');
 await f.locator('#previous').click();assert.equal(await f.locator('#pageNumber').inputValue(),'1');
 await f.locator('#pageNumber').fill('4');await f.locator('#pageNumber').press('Enter');
 assert.equal(await f.locator('#pageNumber').inputValue(),'4');
 await f.locator('#scaleSelect').selectOption('page-fit');
 const scale=await f.evaluate(()=>PDFViewerApplication.pdfViewer.currentScale);
 await f.locator('#zoomInButton').click();assert(await f.evaluate(()=>PDFViewerApplication.pdfViewer.currentScale)>scale);
 await f.locator('#scaleSelect').selectOption('page-width');
 await f.locator('#viewFindButton').click();await f.locator('#findInput').fill('temporal');await f.locator('#findInput').press('Enter');
 await f.locator('#findResultsCount').filter({hasText:/\d/}).waitFor({timeout:12000});
 await f.locator('.textLayer .highlight').first().waitFor({timeout:12000});
 await shot(p,'desktop_zh_light_pdf_search');
 await f.locator('#findInput').press('Escape');
 await f.locator('#pageNumber').fill('1');await f.locator('#pageNumber').press('Enter');
 await f.locator('.page[data-page-number="1"] .textLayer span').first().waitFor();
 const selected=await f.evaluate(()=>{
  const span=[...document.querySelectorAll('.page[data-page-number="1"] .textLayer span')].find(e=>e.textContent.length>8 && e.getBoundingClientRect().height>0);
  const range=document.createRange();range.selectNodeContents(span);getSelection().removeAllRanges();getSelection().addRange(range);
  const selection=getSelection().toString();
  const event=new ClipboardEvent('copy',{clipboardData:new DataTransfer(),bubbles:true,cancelable:true});
  span.dispatchEvent(event);
  return {selection,clipboardEvent:event.clipboardData.getData('text/plain')};
 });
 assert(selected.selection.length>8,JSON.stringify(selected));
 const download=p.waitForEvent('download');
 await f.locator('#downloadButton').click();
 assert((await download).suggestedFilename().endsWith('.pdf'));
 findings.checks.push({name:'official ICML PDF controls',pages:20,search:await f.locator('#findResultsCount').textContent(),...selected,download:true});
 await axe(p,'desktop reader axe');
 await close(p,'.pdf-dialog');
 assert.equal(await scroller.evaluate(e=>e.scrollTop),before);
 assert(await pdf.evaluate(e=>e===document.activeElement));
 await close(p,'.story-dialog');
 assert.equal(await p.evaluate(()=>scrollY),y);
 assert(await opener.evaluate(e=>e===document.activeElement));
 findings.checks.push({name:'Home → Story → PDF → same scroll and focus',passed:true,y,storyScroll:before});
 await c.close();await p.video().saveAs(out+'/recordings/story_to_pdf_return.webm');await p.video().delete();

 const plain=await b.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});watch(plain);
 await plain.goto(base+'/publications.html');
 await plain.locator('[data-filter-group="kind"][data-filter="journal"]').click();
 const apl=plain.locator('a[data-story][href*="high-k-trench"]').filter({visible:true}).first();
 await openStory(plain,apl);
 await story(plain).locator('[data-pdf]').first().click();
 assert.equal(await reader(plain).locator('iframe').count(),0);
 assert((await reader(plain).locator('a').getAttribute('href')).includes('10.1063/5.0345413'));
 await shot(plain,'journal_apl_official_fallback');
 await plain.keyboard.press('Escape');await reader(plain).waitFor({state:'detached'});
 await plain.keyboard.press('Escape');await story(plain).waitFor({state:'detached'});
 assert.equal(await plain.locator('[data-filter-group="kind"][data-filter="journal"]').getAttribute('aria-pressed'),'true');
 findings.checks.push({name:'Publications journal filter and APL official fallback',passed:true});
 for(const lang of ['', 'en/']){
  await plain.goto(base+'/'+lang+'papers/'+icml+'.html');
  const original=plain.url(), link=plain.locator('[data-pdf]').first();await link.click();await ready(plain);await close(plain,'.pdf-dialog');
  assert.equal(plain.url(),original);assert(await link.evaluate(e=>e===document.activeElement));
 }
 findings.checks.push({name:'Bilingual Paper Detail direct reader, permanent URL and focus',passed:true});

 await plain.goto(base+'/research.html#signals');
 const journey=plain.locator('#signals .focus-journey');
 await journey.evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-80));
 await delay(plain,800);await journey.locator('.paper-trigger').nth(1).click();await delay(plain,1200);
 const paper=journey.locator('.is-active');assert.equal(await paper.getAttribute('data-paper-index'),'1');
 await paper.locator('.figure-select').nth(1).click();
 const researchLink=paper.locator('[data-story]');await researchLink.scrollIntoViewIfNeeded();await delay(plain);
 const snapshot=await plain.evaluate(()=>({y:scrollY,p:document.querySelector('#signals .is-active').dataset.paperIndex,figure:document.querySelector('#signals .is-active .focus-figures').dataset.primaryIndex}));
 await openStory(plain,researchLink);await story(plain).locator('[data-pdf]').first().click();
 await reader(plain).locator('input[type="file"]').setInputFiles(out+'/test.pdf');const local=await ready(plain);
 assert.equal(await local.evaluate(()=>PDFViewerApplication.pagesCount),3);
 await close(plain,'.pdf-dialog');await close(plain,'.story-dialog');
 const after=await plain.evaluate(()=>({y:scrollY,p:document.querySelector('#signals .is-active').dataset.paperIndex,figure:document.querySelector('#signals .is-active .focus-figures').dataset.primaryIndex}));
 assert.deepEqual(after,snapshot);
 findings.checks.push({name:'Research Signals P2/B → Story → local test PDF → same P2/B and viewport',snapshot,after});
 await shot(plain,'research_p2_return');
 await plain.close();

 const pubs=JSON.parse(fs.readFileSync('data/publications.json','utf8'));
 for(const [lang,width,theme] of [['zh',390,'light'],['en',768,'dark'],['en',1440,'dark']]){
  const page=await b.newPage({viewport:{width,height:844},hasTouch:width===390});watch(page);
  await page.addInitScript(t=>localStorage.setItem('theme',t),theme);
  const prefix=lang==='en'?'/en':'';
  for(const pub of pubs){
   await page.goto(base+prefix+'/stories/'+pub.slug+'.html');
   assert.equal(await page.locator('.story-section').count(),7);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
   if([icml,'high-k-trench-gan-hemt','spiking-som-radar-deinterleaving','dual-model-snn-remote-sensing'].includes(pub.slug))await shot(page,lang+'_'+theme+'_'+width+'_'+pub.slug);
  }
  await page.goto(base+prefix+'/stories/'+icml+'.html');
  await page.locator('[data-pdf]').first().click();await ready(page);await shot(page,lang+'_'+theme+'_'+width+'_pdf');
  await axe(page,lang+'_'+theme+'_'+width+' reader axe');
  await close(page,'.pdf-dialog');await page.close();
  findings.checks.push({name:'all standalone Stories + reader',lang,width,theme,count:11});
 }

 for(const [name,status,body] of [['missing',404,'missing'],['permission',403,'denied'],['format',200,'<html>signin</html>'],['network',0,'']]){
  const page=await b.newPage();
  await page.route(source,r=>status?r.fulfill({status,contentType:'text/html',body}):r.abort());
  await page.goto(base+'/stories/'+icml+'.html');await page.locator('[data-pdf]').first().click();
  await page.locator('.reader-status[data-state="'+name+'"]').waitFor();
  assert(await reader(page).locator('a').isVisible());
  await shot(page,'error_'+name);await page.close();
  findings.checks.push({name:'source failure '+name,passed:true,simulated:true});
 }
 }finally{await b.close()}

 const ff=await firefox.launch();
 try{
  const p=await ff.newPage({viewport:{width:1366,height:768}});watch(p);
  await p.goto(base+'/en/stories/'+icml+'.html');
  await p.locator('[data-pdf]').first().click();const f=await ready(p);
  assert.equal(await f.evaluate(()=>PDFViewerApplication.pagesCount),20);
  await shot(p,'firefox_en_pdf');
  await close(p,'.pdf-dialog');
  findings.checks.push({name:'Firefox official PDF renders and closes',passed:true});
 }finally{await ff.close()}
}
run().catch(e=>{findings.failure=e.stack;process.exitCode=1}).finally(()=>{fs.writeFileSync(out+'/logs/browser.json',JSON.stringify(findings,null,2));console.log(JSON.stringify({checks:findings.checks.length,errors:findings.errors,failure:findings.failure}));});
