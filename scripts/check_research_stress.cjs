const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
const OUT='tmp/v35',BASE='http://127.0.0.1:8095';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const report={hotzones:[],hover100:[],rapid30:[]};
 let page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.addInitScript(()=>{window.__scrollCalls=[];for(const name of ['scrollBy','scrollTo']){const f=window[name];window[name]=function(...args){__scrollCalls.push({name,args});return f.apply(this,args);};}});
 await page.goto(BASE+'/research.html');await page.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
 async function selected(area,slug){await page.waitForFunction(([area,slug])=>document.querySelector('#'+area+' .stage-content').dataset.stageSlug===slug&&!document.querySelector('#'+area+' .preview-stage').hasAttribute('aria-busy'),[area,slug]);}
 for(const area of ['learning','signals','device'])for(const row of await page.locator('#'+area+' .research-paper').all()){
  const slug=await row.getAttribute('data-preview-slug');
  for(const zone of ['left','right','venue','summary']){
   await page.mouse.move(1,1);await page.waitForTimeout(180);await row.scrollIntoViewIfNeeded();
   if(zone==='left'||zone==='right'){const box=await row.boundingBox();await row.hover({position:{x:zone==='left'?4:box.width-4,y:20}});}else await row.locator(zone==='venue'?'.venue':'.research-summary').hover();
   await selected(area,slug);report.hotzones.push({area,slug,zone,passed:true});
  }
 }
 const learn=page.locator('#learning');await learn.locator('.reset-preview').click();
 await learn.locator('.research-paper').first().scrollIntoViewIfNeeded();
 await page.evaluate(()=>{
  window.__latencies=[];window.__starts={};document.querySelectorAll('#learning .research-paper').forEach(row=>row.addEventListener('pointerenter',()=>__starts[row.dataset.previewSlug]=performance.now()));
  new MutationObserver(()=>{const slug=document.querySelector('#learning .stage-content').dataset.stageSlug;if(__starts[slug])__latencies.push(performance.now()-__starts[slug]);}).observe(document.querySelector('#learning .stage-content'),{attributes:true,attributeFilter:['data-stage-slug']});
 });
 const height=await page.evaluate(()=>document.documentElement.scrollHeight);
 for(let i=0;i<100;i++){
  const row=learn.locator('.research-paper').nth(i%2);await row.hover({position:{x:8,y:16}});const y=await page.evaluate(()=>scrollY);await selected('learning',await row.getAttribute('data-preview-slug'));
  assert.equal(await page.evaluate(()=>scrollY),y);assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),height);report.hover100.push({index:i,scrollY:y,stable:true});
 }
 const signals=page.locator('#signals');
 for(let i=0;i<30;i++){
  const row=signals.locator('.research-paper').nth(i%3),start=Date.now();await row.hover({position:{x:6,y:15}});const slug=await row.getAttribute('data-preview-slug');await selected('signals',slug);report.rapid30.push({index:i,slug,passed:true});await page.waitForTimeout(Math.max(0,333-(Date.now()-start)));
 }
 report.appScrollCalls=await page.evaluate(()=>__scrollCalls);assert.equal(report.appScrollCalls.length,0);
 report.hoverToPreviewMs=await page.evaluate(()=>__latencies);const sorted=[...report.hoverToPreviewMs].sort((a,b)=>a-b);report.hoverLatencyP95Ms=sorted[Math.floor(sorted.length*.95)];
 // Ordinary wheel input must still move the page and stay where the user put it.
 await page.mouse.move(20,300);await page.mouse.wheel(0,200);await page.waitForTimeout(200);const y=await page.evaluate(()=>scrollY);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>scrollY),y);report.voluntaryScrollNotCorrected=true;
 await page.locator('#device .research-paper').last().scrollIntoViewIfNeeded();const bounds=await page.locator('#device').boundingBox(),stage=await page.locator('#device .preview-stage').boundingBox();assert(stage.y+stage.height<=bounds.y+bounds.height+1);report.stickyInsideSection=true;
 await page.emulateMedia({reducedMotion:'reduce'});await learn.locator('.research-paper').first().hover();await selected('learning','mte-ste-continuous-temporal-signal-classification');assert.equal(await page.evaluate(()=>document.getAnimations().length),0);report.reducedMotion=true;
 // 200% layout equivalent; this is not a claim about native browser menu zoom.
 await page.setViewportSize({width:720,height:450});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),720);report.zoom='720x450 CSS viewport, 200% layout equivalent; native menu zoom untested';
 await page.locator('#learning .research-paper-title').first().click();await page.waitForURL('**/papers/*.html');await page.goBack();assert.equal(await page.locator('.research-paper').count(),10);report.historyBack=true;await page.close();
 // Slow out-of-order image completion must not overwrite the newest selection.
 page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.route('**/*main-results.png',async route=>{await new Promise(r=>setTimeout(r,900));await route.continue();});
 await page.goto(BASE+'/research.html');await page.locator('#learning .research-paper').first().hover({position:{x:5,y:15}});await page.waitForTimeout(150);
 assert.equal(await page.locator('#learning .stage-content').getAttribute('data-stage-slug'),'overview');
 await page.locator('#learning .research-paper').nth(1).hover({position:{x:5,y:15}});await selected('learning','mpo-surrogate-function-snn');await page.waitForTimeout(1100);assert.equal(await page.locator('#learning .stage-content').getAttribute('data-stage-slug'),'mpo-surrogate-function-snn');
 await page.screenshot({path:OUT+'/screenshots/slow_network_latest_selection.png'});report.slowNetworkLastRequestWins=true;await page.close();
 // Explicit failed image has useful alt text and its original link remains available.
 page=await browser.newPage({viewport:{width:1440,height:900}});await page.route('**/*surrogate-mismatch.png',route=>route.abort());await page.goto(BASE+'/research.html');await page.locator('#learning .research-paper').nth(1).hover({position:{x:5,y:15}});await selected('learning','mpo-surrogate-function-snn');assert((await page.locator('#learning .stage-content img').first().getAttribute('alt')).includes('暂不可用'));assert.equal(await page.locator('#learning .stage-content .full-figure-link').count(),2);report.imageFailureFallback=true;await page.close();
 await browser.close();fs.writeFileSync(OUT+'/logs/research_stress.json',JSON.stringify(report,null,2));console.log(JSON.stringify({hotzones:report.hotzones.length,hover100:report.hover100.length,rapid30:report.rapid30.length,hoverLatencyP95Ms:report.hoverLatencyP95Ms,appScrollCalls:0,slowNetwork:true,reducedMotion:true}));
})().catch(e=>{console.error(e);process.exit(1)});
