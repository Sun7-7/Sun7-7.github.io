const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs');
const out='tmp/v34-smooth/logs';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'}),results=[];
for(const width of [1440,390]){
 const p=await b.newPage({viewport:{width,height:900},hasTouch:width<500});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8094/research.html');
 await p.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
 await p.locator('#learning .research-paper-title').first().scrollIntoViewIfNeeded();
 const frames=await p.evaluate(async()=>{
  const section=document.querySelector('#learning'),title=section.querySelector('.research-paper-title'),gallery=section.querySelector(':scope > .research-figure-pair'),panel=section.querySelector('.paper-preview');
  const samples=[],before=title.getBoundingClientRect().top;
  title.focus({preventScroll:true});const start=performance.now();
  while(performance.now()-start<420){await new Promise(requestAnimationFrame);samples.push({ms:performance.now()-start,galleryHeight:gallery.hidden?0:gallery.getBoundingClientRect().height,panelHeight:panel.hidden?0:panel.getBoundingClientRect().height,titleDrift:title.getBoundingClientRect().top-before,transitioning:section.hasAttribute('data-transitioning')});}
  return samples;
 });
 assert(frames.some(x=>x.ms<300&&x.panelHeight>0&&x.panelHeight<frames.at(-1).panelHeight-5),'must have intermediate expansion');assert(Math.max(...frames.map(x=>Math.abs(x.titleDrift)))<4,'title stable through animation');
 // Switch during a running animation, then Escape during the next one.
 await p.locator('#learning .research-paper-title').nth(1).focus();await p.waitForTimeout(60);await p.locator('#learning .research-paper-title').first().focus();await p.waitForTimeout(60);await p.keyboard.press('Escape');await p.waitForTimeout(400);
 assert.equal(await p.locator('#learning .paper-preview:visible').count(),0);assert(await p.locator('#learning > .research-figure-pair').isVisible());assert.equal(await p.locator('#learning [inert]').count(),0);assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);assert.equal(errors.length,0);
 await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#learning .research-paper-title').first().focus();assert.equal(await p.locator('#learning').getAttribute('data-transitioning'),null);assert.equal(await p.evaluate(()=>document.getAnimations().length),0);
 results.push({width,frames,rapidSwitchAndEscape:true,reducedMotion:true,errors});await p.close();
}
await b.close();fs.writeFileSync(out+'/transition_frames.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(x=>({width:x.width,frames:x.frames.length,maxTitleDrift:Math.max(...x.frames.map(f=>Math.abs(f.titleDrift))),rapidSwitchAndEscape:true,reducedMotion:true}))));})().catch(e=>{console.error(e);process.exit(1)});
