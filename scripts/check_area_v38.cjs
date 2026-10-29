const{chromium}=require('playwright');const fs=require('fs'),assert=require('assert/strict');
const OUT='tmp/v38',BASE='http://127.0.0.1:8098';fs.mkdirSync(OUT+'/screenshots',{recursive:true});
const report={checks:[],roam:[],axe:[],errors:[]};
const wait=(p,n=1800)=>p.waitForTimeout(n);
async function state(p){return p.evaluate(()=>({area:document.body.dataset.activeArea,hash:location.hash,y:scrollY,height:document.documentElement.scrollHeight,nav:document.querySelector('.area-navigator').getBoundingClientRect().toJSON(),sections:[...document.querySelectorAll('.research-theme')].map(s=>({id:s.id,top:s.getBoundingClientRect().top,heading:s.querySelector('h2').getBoundingClientRect().top,paper:s.querySelector('.focus-journey').dataset.activeIndex}))}));}
(async()=>{const b=await chromium.launch({channel:'msedge'});try{if(process.env.AREA_STRESS_ONLY){const old=JSON.parse(fs.readFileSync(OUT+'/logs/area_checks.json','utf8'));report.checks=old.checks;report.axe=old.axe;}for(const width of (process.env.AREA_STRESS_ONLY?[]:[1440,1280,1024,390,375,320]))for(const lang of ['zh','en'])for(const theme of ['light','dark']){
 const key=`${width}-${lang}-${theme}`,c=await b.newContext({viewport:{width,height:width>=1024?900:844},hasTouch:width<700,isMobile:width<700});await c.addInitScript(t=>localStorage.setItem('theme',t),theme);const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await p.goto(BASE+'/'+(lang==='en'?'en/':'')+'research.html');await p.screenshot({path:OUT+'/screenshots/'+key+'-explorer.png'});
 assert.equal(await p.locator('.area-card').count(),3);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
 for(const id of ['device','signals','learning']){
  await p.locator(`.area-card[href="#${id}"]`).click();await wait(p);const s=await state(p);assert.equal(s.area,id,JSON.stringify(s));assert.equal(s.hash,'#'+id);const target=s.sections.find(x=>x.id===id);assert(target.heading>=s.nav.bottom-2);assert.equal(target.paper,'0');
  const media=p.locator('#'+id+' .is-active .focus-figures');const next=1-Number(await media.getAttribute('data-primary-index'));await media.locator('.figure-select').nth(next).click();await wait(p,400);assert.equal(await media.getAttribute('data-media-state'),'pinned');
  await p.screenshot({path:OUT+'/screenshots/'+key+'-'+id+'.png'});report.checks.push({key,id,...s,innerPinned:true});
 }
 await p.goBack();await wait(p);assert.equal((await state(p)).area,'signals',JSON.stringify(await state(p)));await p.goForward();await wait(p);assert.equal((await state(p)).area,'learning');
 await p.locator('.area-nav-links a[href="#device"]').hover();await wait(p,200);assert.equal((await state(p)).area,'learning');
 await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const a=await p.evaluate(async()=>{const r=await axe.run();return{violations:r.violations,incomplete:r.incomplete.map(x=>({id:x.id,nodes:x.nodes.length}))};});report.axe.push({key,...a});assert.equal(a.violations.length,0,JSON.stringify(a.violations));
 await c.close();
}
const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto(BASE+'/research.html');await p.locator('.area-card[href="#learning"]').click();await wait(p);await p.mouse.move(2,2);
for(let i=0;i<48;i++){await p.mouse.wheel(0,200);await wait(p,80);report.roam.push(await state(p));}for(let i=0;i<48;i++){await p.mouse.wheel(0,-200);await wait(p,80);report.roam.push(await state(p));}
for(const id of ['learning','signals','device'])assert(report.roam.some(r=>r.area===id&&r.sections.find(x=>x.id===id).paper==='0'),id);
await p.emulateMedia({reducedMotion:'reduce'});for(const id of ['device','learning']){await p.locator(`.area-nav-links a[href="#${id}"]`).click();await p.waitForFunction(id=>document.body.dataset.activeArea===id,id,{timeout:3000}).catch(async()=>{throw Error(JSON.stringify(await state(p)));});assert.equal((await state(p)).area,id);}
await p.goto(BASE+'/research.html#signals');await wait(p);assert.equal((await state(p)).area,'signals',JSON.stringify(await state(p)));await p.reload();await wait(p);assert.equal((await state(p)).area,'signals',JSON.stringify(await state(p)));
await p.close();for(const width of [1440,320]){const c=await b.newContext({viewport:{width,height:900},javaScriptEnabled:false}),p=await c.newPage();await p.goto(BASE+'/research.html');await p.locator('.area-card[href="#device"]').click();assert(p.url().endsWith('#device'));assert.equal(await p.locator('.paper-body:visible').count(),10);await p.screenshot({path:OUT+'/screenshots/'+width+'-no-js.png'});await c.close();}
report.passed=true;
}catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}finally{await b.close();fs.writeFileSync(OUT+'/logs/area_checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,axe:report.axe.length,roam:report.roam.length,errors:report.errors}));}})();
