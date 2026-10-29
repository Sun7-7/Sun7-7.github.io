/* Compare real rendered intermediate geometry against the previous candidate. */
const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const OUT='tmp/motion';fs.mkdirSync(OUT+'/logs',{recursive:true});fs.mkdirSync(OUT+'/videos',{recursive:true});fs.mkdirSync(OUT+'/screenshots',{recursive:true});
const report={checks:[],errors:[],baseline:'0fc4c848cd66bc652929f358daf3f8d984bf93a6'};
async function sample(p,selector,action){await p.evaluate(sel=>{window.__motion=[];const start=performance.now(),e=document.querySelector(sel);function frame(t){const r=e.getBoundingClientRect();window.__motion.push({t:t-start,height:r.height,width:r.width,y:r.y});if(t-start<760)requestAnimationFrame(frame);}requestAnimationFrame(frame);},selector);await action();await p.waitForTimeout(800);return p.evaluate(()=>window.__motion);}
function distinct(samples,k){return new Set(samples.map(s=>Math.round(s[k]*10)/10)).size;}
(async()=>{const b=await chromium.launch({channel:'msedge'});try{for(const baseline of [true,false])for(const width of [1440,390])for(const lang of (baseline?['zh']:['zh','en']))for(const theme of (baseline?['light']:['light','dark'])){
 const key=`${baseline?'before':'after'}-${width}-${lang}-${theme}`,c=await b.newContext({viewport:{width,height:900},hasTouch:width<700,isMobile:width<700,recordVideo:!baseline&&lang==='zh'&&theme==='light'?{dir:OUT+'/videos',size:{width,height:900}}:undefined});
 if(baseline)for(const file of ['css/style.css','js/main.js'])await c.route('**/'+file+'*',r=>r.fulfill({body:execFileSync('git',['show',report.baseline+':'+file],{encoding:'utf8'}),contentType:file.endsWith('css')?'text/css':'application/javascript'}));
 await c.addInitScript(t=>localStorage.setItem('theme',t),theme);const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto('http://127.0.0.1:8098/'+(lang==='en'?'en/':'')+'research.html');
 const j=p.locator('#learning .focus-journey');await j.evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--area-nav-height'))||0)-16,behavior:'instant'}));await p.waitForTimeout(700);assert.equal(await j.getAttribute('data-active-index'),'0');await p.mouse.move(2,2);
 // The next trigger is in view; do not let automation scroll the page mid-transition.
 const row=await sample(p,'#learning .focus-paper:nth-child(2)',()=>j.locator('.paper-trigger').nth(1).click());
 assert.equal(await j.getAttribute('data-active-index'),'1');if(!baseline)assert(distinct(row,'height')>=8,key+': row did not interpolate');
 const next=1-Number(await j.locator('.is-active .focus-figures').getAttribute('data-primary-index'));
 const media=await sample(p,'#learning .is-active .figure-select',()=>j.locator('.is-active .figure-select').nth(next).click());
 if(!baseline)assert(distinct(media,width<700?'height':'width')>=6,key+': media did not interpolate');
 await p.screenshot({path:OUT+'/screenshots/'+key+'.png'});
 // Interrupt an unfinished opening with the original row, then reopen the second.
 await j.locator('.paper-trigger').first().click();await p.waitForTimeout(80);await j.locator('.paper-trigger').nth(1).click();await p.waitForTimeout(1100);assert.equal(await j.getAttribute('data-active-index'),'1');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
 await p.emulateMedia({reducedMotion:'reduce'});await j.locator('.paper-trigger').first().click();await p.waitForTimeout(50);if(!baseline)assert.equal(await j.locator('.paper-body').evaluateAll(es=>es.flatMap(e=>e.getAnimations()).length),0);
 report.checks.push({key,rowDistinct:distinct(row,'height'),mediaDistinct:distinct(media,width<700?'height':'width'),row,media});const v=p.video();await c.close();if(v){await v.saveAs(OUT+'/videos/'+key+'.webm');await v.delete();}
 }report.passed=true;}catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}finally{await b.close();fs.writeFileSync(OUT+'/logs/motion_checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.map(({key,rowDistinct,mediaDistinct})=>({key,rowDistinct,mediaDistinct})),errors:report.errors}));}})();
