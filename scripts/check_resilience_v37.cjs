const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const OUT=path.resolve(process.env.REVIEW_PACKET_DIR||'tmp/v37'),BASE=process.env.TEST_BASE_URL||'http://127.0.0.1:8097';
fs.mkdirSync(OUT+'/logs',{recursive:true});
const report={scope:'Local synthetic interaction samples; not physical display FPS or production network measurements',checks:[]};
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto(BASE+'/research.html');
 await p.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));const e=document.querySelector('#learning .focus-journey');scrollTo(0,e.getBoundingClientRect().top+scrollY-24);});await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__samples=[];window.__tasks=[];window.__measure=true;try{new PerformanceObserver(list=>window.__tasks.push(...list.getEntries().map(e=>({time:e.startTime,duration:e.duration})))).observe({entryTypes:['longtask']});}catch{};function tick(t){window.__samples.push({time:t,y:scrollY,height:document.documentElement.scrollHeight,index:document.querySelector('#learning .focus-journey').dataset.activeIndex});if(window.__measure)requestAnimationFrame(tick);}requestAnimationFrame(tick);});
 await p.mouse.move(3,3);for(let i=0;i<12;i++){await p.mouse.wheel(0,i%4<2?270:-270);await p.waitForTimeout(150);}
 await p.waitForTimeout(400);for(let i=0;i<6;i++){const row=p.locator('#learning .focus-paper').nth(1),box=await row.boundingBox();await p.mouse.move(box.x+box.width-30,box.y+box.height/2);await p.waitForTimeout(180);await p.mouse.move(3,3);await p.waitForTimeout(180);}
 const row=p.locator('#learning .focus-paper').nth(1),box=await row.boundingBox();await p.mouse.move(box.x+box.width-30,box.y+box.height/2);await p.waitForTimeout(550);assert.equal(await p.locator('#learning .focus-journey').getAttribute('data-active-index'),'1');
 const expanded=await row.boundingBox();await p.mouse.move(expanded.x+expanded.width-30,expanded.y+expanded.height+5);await p.waitForTimeout(450);assert.equal(await p.locator('#learning .focus-journey').getAttribute('data-active-index'),'0');report.checks.push({name:'real_pointer_move_to_row_gap_restores_position',passed:true});
 const sample=await p.evaluate(()=>{window.__measure=false;return {frames:window.__samples,longTasks:window.__tasks};});const intervals=sample.frames.slice(1).map((s,i)=>s.time-sample.frames[i].time),sorted=[...intervals].sort((a,b)=>a-b);assert.equal(new Set(sample.frames.map(f=>f.height)).size,1);
 report.interaction={...sample,summary:{frameSamples:sample.frames.length,intervalMedianMs:sorted[Math.floor(sorted.length*.5)],intervalP95Ms:sorted[Math.floor(sorted.length*.95)],intervalMaxMs:Math.max(...intervals),longTasks:sample.longTasks.length,longTaskMaxMs:Math.max(0,...sample.longTasks.map(t=>t.duration)),documentHeight:sample.frames[0].height,documentHeightStable:true}};

 const session=await p.context().newCDPSession(p);await session.send('Performance.enable');await session.send('Emulation.setCPUThrottlingRate',{rate:4});
 const beforeMetrics=await session.send('Performance.getMetrics');const beforeHeight=await p.evaluate(()=>document.documentElement.scrollHeight);
 for(let i=0;i<30;i++){await p.locator('#learning .is-active .figure-select').nth(i%2).dispatchEvent('click');await p.waitForTimeout(20);}
 await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>document.documentElement.scrollHeight),beforeHeight);
 const afterMetrics=await session.send('Performance.getMetrics');report.lowPerformance={cpuSlowdown:4,syntheticClickEvents:30,documentHeightStable:true,beforeMetrics,afterMetrics};
 await session.send('Emulation.setCPUThrottlingRate',{rate:1});
 await p.close();
 const asset='**/assets/images/paper-figures/dual-model-snn-remote-sensing-dual-distillation.png';
 for(const mode of ['delayed','failed']){
  const c=await b.newContext({viewport:{width:1440,height:900}});let requested=false;
  await c.route(asset,async route=>{requested=true;if(mode==='delayed'){await new Promise(r=>setTimeout(r,1500));await route.continue();}else await route.abort('failed');});
  const p=await c.newPage();await p.goto(BASE+'/research.html');const j=p.locator('#learning .focus-journey');const baseline=await p.evaluate(()=>document.documentElement.scrollHeight);
  await j.locator('.paper-trigger').nth(2).click();await p.waitForTimeout(mode==='delayed'?1900:1100);const img=j.locator('.is-active img').first();assert(requested);assert.equal(await p.evaluate(()=>document.documentElement.scrollHeight),baseline);
  if(mode==='delayed')assert(await img.evaluate(i=>i.naturalWidth>0));else{assert(await img.evaluate(i=>i.alt.includes('暂不可用')));assert(await j.locator('.is-active .figure-zoom').first().getAttribute('href'));}
  report.checks.push({name:mode+'_figure',passed:true,reservedLayoutStable:true,originalLinkRetained:true,expectedNetworkFailure:mode==='failed'});await c.close();
 }
 report.passed=true;
}catch(e){report.passed=false;report.error=e.stack;process.exitCode=1;}finally{await b.close();fs.writeFileSync(OUT+'/logs/resilience_and_scroll_performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,interaction:report.interaction?.summary,checks:report.checks,error:report.error}));}})();
