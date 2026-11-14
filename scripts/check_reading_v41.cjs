const {chromium}=require('playwright'), fs=require('node:fs'), assert=require('node:assert/strict');
const base='http://127.0.0.1:8103', out='tmp/v411';
const rows=JSON.parse(fs.readFileSync('data/pdf_sources.json','utf8'));
const result={papers:[],checks:[],errors:[]};
const status=p=>p.locator('.reader-status');
async function ready(p){await p.locator('.reader-status[data-state=ready]').waitFor({state:'attached',timeout:24000});return p.frames().find(f=>f.url().includes('/viewer.html'));}
async function close(p){await p.locator('.pdf-dialog .reading-bar button').click();await p.locator('.pdf-dialog').waitFor({state:'detached'});}
async function run(){
 fs.mkdirSync(out+'/screenshots',{recursive:true});fs.mkdirSync(out+'/recordings',{recursive:true});
 const b=await chromium.launch({channel:'msedge'});
 try{
 const c=await b.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/recordings'}});
 const p=await c.newPage();
 p.on('pageerror',e=>result.errors.push(e.message));
 p.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
 await p.goto(base+'/publications.html');
 for(const row of rows){
  const opener=p.locator('a[data-paper-id="'+row.paperId+'"]').first();
  await opener.click();
  assert.equal(await p.locator('input[type=file]').count(),0);
  if(row.localPdfPath||row.remotePdfUrl){
   const f=await ready(p);
   assert.equal(await f.locator('input[type=file]').count(),0);
   const parsed=await f.evaluate(async()=>{
    const d=PDFViewerApplication.pdfDocument;
    const text=(await (await d.getPage(1)).getTextContent()).items.map(i=>i.str).join(' ');
    return {pages:d.numPages,text};
   });
   const expected={'high-k-trench-gan-hemt':[/PZT/i,5],'mte-ste-continuous-temporal-signal-classification':[/Narrowing/i,20],'hsaf-net-fruit-quality-assessment':[/Fruit Quality Assessment/i,21],'sipos-umofet-fom':[/SIPOS Modulated/i,12],'variable-k-ldmos':[/Variable-K Dielectric/i,9]}[row.paperId];
   assert(expected&&expected[0].test(parsed.text),row.paperId);
   assert.equal(parsed.pages,expected[1]);
   await f.locator('#next').click();assert.equal(await f.locator('#pageNumber').inputValue(),'2');
   await f.locator('#scaleSelect').selectOption('page-fit');
   await p.screenshot({path:out+'/screenshots/'+row.paperId+'.png'});
   result.papers.push({paperId:row.paperId,state:'ready',pages:parsed.pages,identityChecked:true});
  }else{
   await p.locator('.reader-status[data-state=source]').waitFor();
   assert.equal(await p.locator('.pdf-dialog iframe').count(),0);
   assert.equal(await p.locator('.pdf-dialog .reading-tools a').first().getAttribute('href'),row.landingUrl);
   if(row.externalPdfUrl)assert.equal(await p.getByRole('link',{name:/打开出版方 PDF/}).getAttribute('href'),row.externalPdfUrl);
   await p.screenshot({path:out+'/screenshots/'+row.paperId+'.png'});
   result.papers.push({paperId:row.paperId,state:'official-fallback',externalPdf:row.externalPdfUrl});
  }
  await close(p);
  assert(await opener.evaluate(e=>e===document.activeElement));
 }
 const slug='mte-ste-continuous-temporal-signal-classification';
 await p.goto(base+'/index.html');
 const opener=p.locator('a[data-story][href*="'+slug+'"]').first();
 await opener.click();
 const story=p.locator('.story-dialog .story-scroll');await story.locator('.paper-story').waitFor();
 const link=story.locator('[data-paper-id]').first();
 await story.evaluate(e=>e.scrollTop=180);const y=await story.evaluate(e=>e.scrollTop);
 await link.evaluate(e=>e.click());
 const f=await ready(p);
 await f.locator('#viewFindButton').click();await f.locator('#findInput').fill('temporal');await f.locator('#findInput').press('Enter');
 await f.locator('.textLayer .highlight').first().waitFor();
 await f.locator('#findInput').press('Escape');
 await f.locator('#pageNumber').fill('1');await f.locator('#pageNumber').press('Enter');
 await f.locator('.page[data-page-number="1"] .textLayer span').first().waitFor();
 assert(await f.evaluate(()=>{
  const span=[...document.querySelectorAll('.page[data-page-number="1"] .textLayer span')].find(e=>e.textContent.length>8 && e.getBoundingClientRect().height>0);
  const range=document.createRange();range.selectNodeContents(span);getSelection().removeAllRanges();getSelection().addRange(range);
  const event=new ClipboardEvent('copy',{clipboardData:new DataTransfer(),bubbles:true,cancelable:true});
  span.dispatchEvent(event);return event.clipboardData.getData('text/plain').length>8;
 }));
 await f.locator('#zoomInButton').click();
 await close(p);assert.equal(await story.evaluate(e=>e.scrollTop),y);
 assert(await link.evaluate(e=>e===document.activeElement));
 await p.keyboard.press('Escape');await p.locator('.story-dialog').waitFor({state:'detached'});
 assert(await opener.evaluate(e=>e===document.activeElement));
 result.checks.push('search, copy event, zoom, nested scroll and focus');
 await c.close();await p.video().saveAs(out+'/recordings/direct-pdf.webm');await p.video().delete();
 const mobile=await b.newContext({viewport:{width:390,height:844},hasTouch:true});
 const q=await mobile.newPage();await q.goto(base+'/en/papers/'+slug+'.html');
 await q.locator('[data-paper-id]').first().click();await ready(q);
 await q.getByRole('button',{name:'Next page',exact:true}).click();
 assert.equal(await q.frames().at(-1).locator('#pageNumber').inputValue(),'2');
 await q.screenshot({path:out+'/screenshots/mobile-en.png'});await close(q);await mobile.close();
 result.checks.push('mobile direct PDF and pagination');
 for(const [mode,code,body] of [['missing',404,'missing'],['permission',403,'denied'],['format',200,'<html>sign in</html>'],['network',0,'']]){
  const q=await b.newPage();
  await q.route('**/assets/papers/high-k-trench-gan-hemt.pdf',r=>code?r.fulfill({status:code,contentType:'text/html',body}):r.abort());
  await q.goto(base+'/stories/high-k-trench-gan-hemt.html');await q.locator('[data-paper-id]').first().click();
  await q.locator('.reader-status[data-state="'+mode+'"]').waitFor();
  assert(await q.locator('.pdf-dialog .reading-tools a').first().isVisible());
  await q.screenshot({path:out+'/screenshots/error-'+mode+'.png'});await close(q);await q.close();
  result.checks.push(mode+' fallback');
 }
 assert.equal(result.errors.length,0,JSON.stringify(result.errors));
 }finally{await b.close()}
}
run().catch(e=>{result.failure=e.stack;process.exitCode=1}).finally(()=>{fs.writeFileSync(out+'/browser.json',JSON.stringify(result,null,2));console.log(JSON.stringify({papers:result.papers.length,checks:result.checks,errors:result.errors,failure:result.failure}));});
